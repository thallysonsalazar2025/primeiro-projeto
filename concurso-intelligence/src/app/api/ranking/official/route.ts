import { RankingCategory } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { estimateFromOfficialRanking } from '@/lib/ranking';

const querySchema = z.object({
  contestId: z.string().min(1),
  positionId: z.string().min(1),
  category: z.nativeEnum(RankingCategory).default(RankingCategory.GENERAL),
  score: z.coerce.number().finite(),
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
  const rows = await prisma.officialRankingRow.findMany({
    where: { contestId, positionId, category },
    select: { score: true, rank: true, category: true, sourceUrl: true, importedAt: true },
    orderBy: [{ score: 'desc' }, { rank: 'asc' }],
  });

  if (!rows.length) {
    return NextResponse.json({ error: 'Official ranking distribution not found' }, { status: 404 });
  }

  const estimate = estimateFromOfficialRanking(
    score,
    rows.map((row) => ({ score: Number(row.score), rank: row.rank, category: row.category })),
  );
  const sources = [...new Set(rows.map((row) => row.sourceUrl))];
  const lastImportedAt = rows.reduce(
    (latest, row) => (row.importedAt > latest ? row.importedAt : latest),
    rows[0].importedAt,
  );

  return NextResponse.json({
    contestId,
    positionId,
    category,
    score,
    estimate,
    provenance: { sources, lastImportedAt },
    disclaimer: 'Estimativa calculada sobre distribuição oficial importada; não substitui a classificação publicada pelo órgão.',
  });
}
