import { createHash } from 'node:crypto';

export const DEFAULT_EXTERNAL_SOURCE_MAX_BYTES = 25 * 1024 * 1024;

export type ExternalSourceFetchResult = {
  bytes: Uint8Array;
  sha256: string;
  retrievedAt: string;
  sourceUrl: string;
  finalUrl: string;
  contentType: string | null;
};

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

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
  if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.localhost')) {
    throw new Error('Fonte externa não pode apontar para localhost.');
  }

  return parsed;
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

export async function fetchExternalSource(
  rawUrl: string,
  options: {
    maxBytes?: number;
    expectedSha256?: string;
    fetchImpl?: FetchLike;
    now?: () => Date;
  } = {},
): Promise<ExternalSourceFetchResult> {
  const source = assertHttpsUrl(rawUrl);
  const maxBytes = options.maxBytes ?? DEFAULT_EXTERNAL_SOURCE_MAX_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('Limite de tamanho externo inválido.');
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(source, {
    redirect: 'follow',
    headers: { 'user-agent': 'concurso-intelligence-ingestion/1.0' },
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar fonte externa: HTTP ${response.status}.`);
  }

  const finalUrl = assertHttpsUrl(response.url || source.toString()).toString();
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
    finalUrl,
    contentType: response.headers.get('content-type'),
  };
}
