import { z } from 'zod';

export const rankingCategorySchema = z.enum(['GENERAL', 'BLACK', 'PCD', 'OTHER_QUOTA']);
const nonBlankString = z.string().trim().min(1);

export const officialRankingImportSchema = z.object({
  contestId: nonBlankString,
  positionId: nonBlankString,
  sourceUrl: z.string().url(),
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
