import { RankingCategory } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { estimatePlacementFromOfficialScores } from '@/lib/ranking-estimator';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  const estimates = await Promise.all(targets.map(async (target) => {
    if (!target.positionId || target.targetScore === null) return null;

    const [position, officialRows] = await Promise.all([
      prisma.contestPosition.findUnique({
        where: { id: target.positionId },
        select: { id: true, name: true, area: true, vacancies: true },
      }),
      prisma.officialRankingRow.findMany({
        where: {
          contestId: target.contestId,
          positionId: target.positionId,
          category: RankingCategory.GENERAL,
        },
        orderBy: { score: 'desc' },
        select: { score: true },
      }),
    ]);

    const targetScore = Number(target.targetScore);
    const estimate = estimatePlacementFromOfficialScores(
      targetScore,
      officialRows.map((row) => Number(row.score)),
    );

    return {
      targetId: target.id,
      contest: target.contest,
      position,
      category: RankingCategory.GENERAL,
      targetScore,
      estimate,
    };
  }));

  return NextResponse.json({ estimates: estimates.filter((estimate) => estimate !== null) });
}
