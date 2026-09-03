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

  for (const key of parsed.searchParams.keys()) {
    if (isSensitiveSourceQueryKey(key)) {
      throw new Error(`${field} não pode conter parâmetro sensível: ${key}`);
    }
  }

  return parsed;
}
