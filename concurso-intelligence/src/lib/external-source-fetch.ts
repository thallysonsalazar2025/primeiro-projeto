import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const DEFAULT_EXTERNAL_SOURCE_MAX_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

export type ExternalSourceFetchResult = {
  bytes: Uint8Array;
  sha256: string;
  retrievedAt: string;
  sourceUrl: string;
  finalUrl: string;
  contentType: string | null;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type ResolveHost = (hostname: string) => Promise<string[]>;

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
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

function isPrivateIp(address: string) {
  const normalized = address.toLowerCase();
  const family = isIP(normalized);
  if (family === 4) return isPrivateIpv4(normalized);
  if (family !== 6) return true;

  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith('ff')) return true;
  if (normalized.startsWith('2001:db8:')) return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    return isIP(mapped) !== 4 || isPrivateIpv4(mapped);
  }

  return false;
}

function assertHttpsUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('URL externa inválida.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Fonte externa deve usar HTTPS.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Fonte externa não pode conter credenciais na URL.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Fonte externa não pode apontar para host local ou privado.');
  }
  if (isIP(hostname) && isPrivateIp(hostname)) {
    throw new Error('Fonte externa não pode apontar para IP local ou privado.');
  }

  return parsed;
}

async function defaultResolveHost(hostname: string) {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map(({ address }) => address);
}

async function assertPublicDestination(url: URL, resolveHost: ResolveHost) {
  if (isIP(url.hostname)) return;

  let addresses: string[];
  try {
    addresses = await resolveHost(url.hostname);
  } catch {
    throw new Error('Não foi possível resolver a fonte externa.');
  }
  if (addresses.length === 0) throw new Error('Fonte externa não resolveu para nenhum endereço IP.');
  if (addresses.some(isPrivateIp)) {
    throw new Error('Fonte externa não pode resolver para IP local ou privado.');
  }
}

function parseContentLength(response: Response) {
  const raw = response.headers.get('content-length');
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) throw new Error('Content-Length inválido na fonte externa.');
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('Content-Length inválido na fonte externa.');
  return parsed;
}

async function readWithinLimit(response: Response, maxBytes: number) {
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel('external source size limit exceeded').catch(() => undefined);
        throw new Error(`Fonte externa excede o limite de ${maxBytes} bytes.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function fetchWithSafeRedirects(
  source: URL,
  fetchImpl: FetchLike,
  resolveHost: ResolveHost,
  maxRedirects: number,
  signal?: AbortSignal,
) {
  let current = source;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    if (signal?.aborted) throw signal.reason;
    await assertPublicDestination(current, resolveHost);
    const response = await fetchImpl(current, {
      redirect: 'manual',
      headers: { 'user-agent': 'concurso-intelligence-ingestion/1.0' },
      signal,
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, finalUrl: current };
    }

    if (redirectCount === maxRedirects) throw new Error('Fonte externa excedeu o limite de redirecionamentos.');
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirecionamento externo sem destino.');
    current = assertHttpsUrl(new URL(location, current).toString());
  }

  throw new Error('Fonte externa excedeu o limite de redirecionamentos.');
}

export async function fetchExternalSource(
  rawUrl: string,
  options: {
    maxBytes?: number;
    expectedSha256?: string;
    fetchImpl?: FetchLike;
    resolveHost?: ResolveHost;
    maxRedirects?: number;
    timeoutMs?: number;
    now?: () => Date;
  } = {},
): Promise<ExternalSourceFetchResult> {
  const source = assertHttpsUrl(rawUrl);
  const maxBytes = options.maxBytes ?? DEFAULT_EXTERNAL_SOURCE_MAX_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('Limite de tamanho externo inválido.');
  }
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  if (!Number.isSafeInteger(maxRedirects) || maxRedirects < 0) {
    throw new Error('Limite de redirecionamentos inválido.');
  }
  const timeoutMs = options.timeoutMs;
  if (timeoutMs !== undefined && (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647)) {
    throw new Error('Timeout da fonte externa inválido.');
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveHost = options.resolveHost ?? (options.fetchImpl ? async () => ['93.184.216.34'] : defaultResolveHost);
  const controller = timeoutMs === undefined ? undefined : new AbortController();
  const timeout = controller
    ? setTimeout(() => controller.abort(new Error(`Fonte externa excedeu timeout de ${timeoutMs} ms.`)), timeoutMs)
    : undefined;

  try {
    const { response, finalUrl } = await fetchWithSafeRedirects(
      source,
      fetchImpl,
      resolveHost,
      maxRedirects,
      controller?.signal,
    );

    if (!response.ok) {
      throw new Error(`Falha ao baixar fonte externa: HTTP ${response.status}.`);
    }

    const declaredLength = parseContentLength(response);
    if (declaredLength !== null && declaredLength > maxBytes) {
      throw new Error(`Fonte externa excede o limite de ${maxBytes} bytes.`);
    }

    const bytes = await readWithinLimit(response, maxBytes);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const expectedSha256 = options.expectedSha256?.trim().toLowerCase();
    if (expectedSha256) {
      if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
        throw new Error('SHA-256 esperado inválido.');
      }
      if (sha256 !== expectedSha256) {
        throw new Error(`SHA-256 divergente: esperado ${expectedSha256}, obtido ${sha256}.`);
      }
    }

    return {
      bytes,
      sha256,
      retrievedAt: (options.now ?? (() => new Date()))().toISOString(),
      sourceUrl: source.toString(),
      finalUrl: finalUrl.toString(),
      contentType: response.headers.get('content-type'),
    };
  } catch (error) {
    if (controller?.signal.aborted) {
      throw new Error(`Fonte externa excedeu timeout de ${timeoutMs} ms.`);
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
