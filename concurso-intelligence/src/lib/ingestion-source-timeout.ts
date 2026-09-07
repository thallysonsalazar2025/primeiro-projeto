export const DEFAULT_INGESTION_SOURCE_TIMEOUT_MS = 60_000;
export const MAX_INGESTION_SOURCE_TIMEOUT_MS = 2_147_483_647;

export function parseIngestionSourceTimeoutMs(raw: string | undefined) {
  if (raw === undefined || raw.trim() === '') return DEFAULT_INGESTION_SOURCE_TIMEOUT_MS;
  if (!/^\d+$/.test(raw.trim())) {
    throw new Error('INGESTION_SOURCE_TIMEOUT_MS deve ser um inteiro positivo em milissegundos.');
  }

  const parsed = Number(raw.trim());
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > MAX_INGESTION_SOURCE_TIMEOUT_MS) {
    throw new Error(
      `INGESTION_SOURCE_TIMEOUT_MS deve ser um inteiro entre 1 e ${MAX_INGESTION_SOURCE_TIMEOUT_MS} milissegundos.`,
    );
  }

  return parsed;
}
