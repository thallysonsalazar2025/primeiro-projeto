import { RankingCategory } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { estimateFromOfficialRankingAggregate } from '@/lib/ranking';

const scoreSchema = z.string().trim().min(1).transform((value, ctx) => {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Score must be a finite number' });
    return z.NEVER;
  }
  return score;
});

const querySchema = z.object({
  contestId: z.string().min(1),
  positionId: z.string().min(1),
  category: z.nativeEnum(RankingCategory).default(RankingCategory.GENERAL),
  score: scoreSchema,
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid ranking query' }, { status: 400 });
  }

  const { contestId, positionId, category, score } = parsed.data;
  const where = { contestId, positionId, category };

  const [total, higher, equal, sourceRows, importAggregate] = await Promise.all([
    prisma.officialRankingRow.count({ where }),
    prisma.officialRankingRow.count({ where: { ...where, score: { gt: score } } }),
    prisma.officialRankingRow.count({ where: { ...where, score } }),
    prisma.officialRankingRow.findMany({
      where,
      select: { sourceUrl: true, sourcePage: true },
      distinct: ['sourceUrl', 'sourcePage'],
      orderBy: [{ sourceUrl: 'asc' }, { sourcePage: 'asc' }],
    }),
    prisma.officialRankingRow.aggregate({ where, _max: { importedAt: true } }),
  ]);

  if (!total) {
    return NextResponse.json({ error: 'Official ranking distribution not found' }, { status: 404 });
  }

  const estimate = estimateFromOfficialRankingAggregate({ total, higher, equal });
  const sources = sourceRows.map(({ sourceUrl, sourcePage }) => ({ url: sourceUrl, page: sourcePage }));

  return NextResponse.json({
    contestId,
    positionId,
    category,
    score,
    estimate,
    provenance: { sources, lastImportedAt: importAggregate._max.importedAt },
    disclaimer: 'Estimativa calculada sobre distribuição oficial importada; não substitui a classificação publicada pelo órgão.',
  });
}
