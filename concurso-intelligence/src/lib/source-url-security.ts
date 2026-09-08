const SENSITIVE_SOURCE_QUERY_KEYS = new Set([
  'access_token',
  'apikey',
  'api_key',
  'auth',
  'authorization',
  'client_secret',
  'key',
  'password',
  'secret',
  'signature',
  'token',
]);

const SENSITIVE_SOURCE_QUERY_KEY_PARTS = new Set([
  'auth',
  'authorization',
  'key',
  'password',
  'secret',
  'signature',
  'token',
]);

const SENSITIVE_COMPACT_SUFFIXES = [
  'authorization',
  'password',
  'signature',
  'secret',
  'token',
];

export function isSensitiveSourceQueryKey(key: string) {
  const normalized = key.toLowerCase();
  if (SENSITIVE_SOURCE_QUERY_KEYS.has(normalized)) return true;

  const compact = normalized.replace(/[^a-z0-9]+/g, '');
  const compactSensitiveKeys = new Set(
    [...SENSITIVE_SOURCE_QUERY_KEYS].map((sensitiveKey) => sensitiveKey.replace(/[^a-z0-9]+/g, '')),
  );

  if (compactSensitiveKeys.has(compact)) return true;
  if (SENSITIVE_COMPACT_SUFFIXES.some((suffix) => compact.endsWith(suffix))) return true;

  const parts = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  return parts.some((part) => SENSITIVE_SOURCE_QUERY_KEY_PARTS.has(part));
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;

  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function isPrivateLiteralHost(rawHostname: string) {
  const hostname = rawHostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return true;
  if (isPrivateIpv4(hostname)) return true;

  if (!hostname.includes(':')) return false;
  if (hostname === '::' || hostname === '::1') return true;
  if (hostname.startsWith('fc') || hostname.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(hostname)) return true;
  if (hostname.startsWith('ff')) return true;
  if (hostname.startsWith('2001:db8:')) return true;
  if (hostname.startsWith('::ffff:')) {
    return isPrivateIpv4(hostname.slice('::ffff:'.length));
  }

  return false;
}

export function validatePublicHttpUrl(value: string, field: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${field} deve ser uma URL válida`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${field} deve usar http ou https`);
  }

  if (parsed.username || parsed.password) {
    throw new Error(`${field} não pode conter credenciais embutidas`);
  }

  if (isPrivateLiteralHost(parsed.hostname)) {
    throw new Error(`${field} não pode apontar para host local ou privado`);
  }

  for (const key of parsed.searchParams.keys()) {
    if (isSensitiveSourceQueryKey(key)) {
      throw new Error(`${field} não pode conter parâmetro sensível: ${key}`);
    }
  }

  return parsed;
}
