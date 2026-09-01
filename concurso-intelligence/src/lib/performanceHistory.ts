import { prisma } from '@/lib/prisma';
import { classifyPerformanceTrend } from '@/lib/performanceTrend';

export type DailyPerformance = {
  day: string;
  attempts: number;
  correct: number;
  accuracy: number;
};

type DailyPerformanceRow = {
  day: string;
  period: 'previous' | 'current';
  attempts: bigint;
  correct: bigint;
  accuracy: number;
};

export async function getPerformanceHistory(userId: string) {
  const rows = await prisma.$queryRaw<DailyPerformanceRow[]>`
    SELECT
      TO_CHAR(DATE_TRUNC('day', qa."answeredAt"), 'YYYY-MM-DD') AS "day",
      CASE
        WHEN qa."answeredAt" >= CURRENT_DATE - INTERVAL '6 days' THEN 'current'
        ELSE 'previous'
      END AS "period",
      COUNT(*)::bigint AS "attempts",
      SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::bigint AS "correct",
      ROUND(
        (SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100,
        1
      )::double precision AS "accuracy"
    FROM "QuestionAttempt" qa
    WHERE qa."userId" = ${userId}
      AND qa."selected" IS NOT NULL
      AND qa."answeredAt" >= CURRENT_DATE - INTERVAL '13 days'
    GROUP BY DATE_TRUNC('day', qa."answeredAt"), "period"
    ORDER BY DATE_TRUNC('day', qa."answeredAt") ASC
  `;

  const windows = rows.reduce(
    (acc, row) => {
      acc[row.period].attempts += Number(row.attempts);
      acc[row.period].correct += Number(row.correct);
      return acc;
    },
    {
      previous: { attempts: 0, correct: 0 },
      current: { attempts: 0, correct: 0 },
    },
  );

  return {
    dailyHistory: rows.map((row): DailyPerformance => ({
      day: row.day,
      attempts: Number(row.attempts),
      correct: Number(row.correct),
      accuracy: row.accuracy,
    })),
    trend: classifyPerformanceTrend(
      windows.previous.attempts,
      windows.previous.correct,
      windows.current.attempts,
      windows.current.correct,
    ),
  };
}
