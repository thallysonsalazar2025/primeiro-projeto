import { z } from 'zod';
import { validatePublicHttpUrl } from './source-url-security.ts';

export const rankingCategorySchema = z.enum(['GENERAL', 'BLACK', 'PCD', 'OTHER_QUOTA']);
const nonBlankString = z.string().trim().min(1);

const officialRankingSourceUrlSchema = z.string().url().superRefine((value, ctx) => {
  try {
    validatePublicHttpUrl(value, 'sourceUrl');
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : 'sourceUrl inválida',
    });
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
