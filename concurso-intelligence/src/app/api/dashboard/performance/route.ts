import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type BoardPerformanceRow = {
  boardId: string;
  boardName: string;
  acronym: string;
  attempts: bigint;
  correct: bigint;
  accuracy: number;
};

type ContestPerformanceRow = {
  contestId: string;
  contestName: string;
  year: number;
  attempts: bigint;
  correct: bigint;
  accuracy: number;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [boardRows, contestRows] = await Promise.all([
    prisma.$queryRaw<BoardPerformanceRow[]>`
      SELECT
        b."id" AS "boardId",
        b."name" AS "boardName",
        b."acronym" AS "acronym",
        COUNT(*)::bigint AS "attempts",
        SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::bigint AS "correct",
        ROUND(
          (SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100,
          1
        )::double precision AS "accuracy"
      FROM "QuestionAttempt" qa
      INNER JOIN "Question" q ON q."id" = qa."questionId"
      INNER JOIN "ExamBoard" b ON b."id" = q."boardId"
      WHERE qa."userId" = ${user.id}
        AND qa."selected" IS NOT NULL
      GROUP BY b."id", b."name", b."acronym"
      ORDER BY "attempts" DESC, "accuracy" ASC, b."name" ASC
      LIMIT 10
    `,
    prisma.$queryRaw<ContestPerformanceRow[]>`
      SELECT
        c."id" AS "contestId",
        c."name" AS "contestName",
        c."year" AS "year",
        COUNT(*)::bigint AS "attempts",
        SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::bigint AS "correct",
        ROUND(
          (SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100,
          1
        )::double precision AS "accuracy"
      FROM "QuestionAttempt" qa
      INNER JOIN "Question" q ON q."id" = qa."questionId"
      INNER JOIN "Exam" e ON e."id" = q."examId"
      INNER JOIN "Contest" c ON c."id" = e."contestId"
      WHERE qa."userId" = ${user.id}
        AND qa."selected" IS NOT NULL
      GROUP BY c."id", c."name", c."year"
      ORDER BY "attempts" DESC, "accuracy" ASC, c."year" DESC, c."name" ASC
      LIMIT 10
    `,
  ]);

  return NextResponse.json({
    boards: boardRows.map((row) => ({
      boardId: row.boardId,
      boardName: row.boardName,
      acronym: row.acronym,
      attempts: Number(row.attempts),
      correct: Number(row.correct),
      accuracy: row.accuracy,
    })),
    contests: contestRows.map((row) => ({
      contestId: row.contestId,
      contestName: row.contestName,
      year: row.year,
      attempts: Number(row.attempts),
      correct: Number(row.correct),
      accuracy: row.accuracy,
    })),
  });
}
