import { prisma } from '@/lib/prisma';

type WeeklyPerformanceRow = {
  weekStart: Date;
  attempts: bigint;
  correct: bigint;
  accuracy: number;
};

export type WeeklyPerformance = {
  weekStart: string;
  attempts: number;
  correct: number;
  accuracy: number;
};

export async function getDashboardWeeklyPerformance(userId: string): Promise<WeeklyPerformance[]> {
  const rows = await prisma.$queryRaw<WeeklyPerformanceRow[]>`
    SELECT
      DATE_TRUNC(
        'week',
        (qa."answeredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo'
      ) AS "weekStart",
      COUNT(*)::bigint AS "attempts",
      SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::bigint AS "correct",
      ROUND(
        (SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100,
        1
      )::double precision AS "accuracy"
    FROM "QuestionAttempt" qa
    WHERE qa."userId" = ${userId}
      AND qa."selected" IS NOT NULL
      AND ((qa."answeredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo') >=
        DATE_TRUNC('week', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '7 weeks'
    GROUP BY 1
    ORDER BY "weekStart" ASC
  `;

  return rows.map((row) => ({
    weekStart: row.weekStart.toISOString().slice(0, 10),
    attempts: Number(row.attempts),
    correct: Number(row.correct),
    accuracy: row.accuracy,
  }));
}
