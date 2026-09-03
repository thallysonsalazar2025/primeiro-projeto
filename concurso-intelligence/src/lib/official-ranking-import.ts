import { z } from 'zod';

export const rankingCategorySchema = z.enum(['GENERAL', 'BLACK', 'PCD', 'OTHER_QUOTA']);
const nonBlankString = z.string().trim().min(1);

const SENSITIVE_SOURCE_QUERY_KEYS = new Set([
  'access_token',
  'apikey',
  'api_key',
  'auth',
  'authorization',
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

function isSensitiveSourceQueryKey(key: string) {
  const normalized = key.toLowerCase();
  if (SENSITIVE_SOURCE_QUERY_KEYS.has(normalized)) return true;

  const parts = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  return parts.some((part) => SENSITIVE_SOURCE_QUERY_KEY_PARTS.has(part));
}

const officialRankingSourceUrlSchema = z.string().url().superRefine((value, ctx) => {
  const parsed = new URL(value);

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'sourceUrl deve usar http ou https' });
  }

  if (parsed.username || parsed.password) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'sourceUrl não pode conter credenciais embutidas' });
  }

  for (const key of parsed.searchParams.keys()) {
    if (isSensitiveSourceQueryKey(key)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `sourceUrl não pode conter parâmetro sensível: ${key}` });
    }
  }
});

export const officialRankingImportSchema = z.object({
  contestId: nonBlankString,
  positionId: nonBlankString,
  sourceUrl: officialRankingSourceUrlSchema,
  sourcePage: z.number().int().positive().nullable().optional(),
  rows: z.array(z.object({
    candidateKey: nonBlankString,
    score: z.number().finite(),
    rank: z.number().int().positive().nullable().optional(),
    category: rankingCategorySchema.default('GENERAL'),
    sourcePage: z.number().int().positive().nullable().optional(),
  })).min(1),
});

export type OfficialRankingImport = z.infer<typeof officialRankingImportSchema>;

export function parseOfficialRankingImport(input: unknown): OfficialRankingImport {
  return officialRankingImportSchema.parse(input);
}

export function buildRankingDedupKey(row: Pick<OfficialRankingImport['rows'][number], 'candidateKey' | 'category'>) {
  return `${row.category}:${row.candidateKey}`;
}

export function assertNoDuplicateRankingRows(payload: OfficialRankingImport) {
  const seen = new Set<string>();
  for (const row of payload.rows) {
    const key = buildRankingDedupKey(row);
    if (seen.has(key)) throw new Error(`Linha duplicada no arquivo: ${key}`);
    seen.add(key);
  }
}
