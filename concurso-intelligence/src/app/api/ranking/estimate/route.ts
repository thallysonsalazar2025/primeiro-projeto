import { Prisma, RankingCategory } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { estimateFromOfficialRankingAggregate } from '@/lib/ranking';

const querySchema = z.object({
  category: z.nativeEnum(RankingCategory).default(RankingCategory.GENERAL),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid ranking query' }, { status: 400 });
  }
  const { category } = parsed.data;

  const targets = await prisma.userContestTarget.findMany({
    where: {
      userId: user.id,
      positionId: { not: null },
      targetScore: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      contest: { select: { id: true, name: true, year: true } },
    },
  });

  const positionIds = targets.flatMap((target) => (target.positionId ? [target.positionId] : []));
  const positions = positionIds.length
    ? await prisma.contestPosition.findMany({
        where: { id: { in: positionIds } },
        select: { id: true, name: true, area: true, vacancies: true },
      })
    : [];
  const positionById = new Map(positions.map((position) => [position.id, position]));

  const estimates = [];
  for (const target of targets) {
    if (!target.positionId || target.targetScore === null) continue;

    const position = positionById.get(target.positionId);
    if (!position) continue;

    const targetScore = Number(target.targetScore);
    const where = {
      contestId: target.contestId,
      positionId: target.positionId,
      category,
    };

    const aggregate = await prisma.$transaction(
      async (tx) => {
        const [total, higher, equal] = await Promise.all([
          tx.officialRankingRow.count({ where }),
          tx.officialRankingRow.count({ where: { ...where, score: { gt: targetScore } } }),
          tx.officialRankingRow.count({ where: { ...where, score: targetScore } }),
        ]);
        return { total, higher, equal };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    if (!aggregate.total) continue;

    estimates.push({
      targetId: target.id,
      contest: target.contest,
      position,
      category,
      targetScore,
      estimate: estimateFromOfficialRankingAggregate(aggregate),
      disclaimer: 'Estimativa calculada sobre distribuição oficial importada; não substitui a classificação publicada pelo órgão.',
    });
  }

  return NextResponse.json({ estimates });
}
