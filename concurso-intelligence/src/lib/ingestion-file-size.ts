import { createReadStream } from 'node:fs';

export const DEFAULT_MAX_INGESTION_FILE_BYTES = 10 * 1024 * 1024;

export function parseMaxIngestionFileBytes(value: string | undefined) {
  if (!value) return DEFAULT_MAX_INGESTION_FILE_BYTES;
  if (!/^\d+$/.test(value)) throw new Error(`INGESTION_MAX_FILE_BYTES inválido: ${value}`);

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`INGESTION_MAX_FILE_BYTES inválido: ${value}`);
  }
  return parsed;
}

export function assertIngestionFileSize(sizeBytes: number, maxBytes: number) {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
    throw new Error(`Tamanho de arquivo inválido: ${sizeBytes}`);
  }
  if (sizeBytes > maxBytes) {
    throw new Error(`arquivo de ingestão excede o limite de ${maxBytes} bytes`);
  }
}

export async function readIngestionFileWithinLimit(path: string, maxBytes: number) {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of createReadStream(path)) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    assertIngestionFileSize(totalBytes, maxBytes);
    chunks.push(buffer);
  }

  return Buffer.concat(chunks, totalBytes);
}
