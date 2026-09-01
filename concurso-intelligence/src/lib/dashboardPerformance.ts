import { prisma } from '@/lib/prisma';

export type BoardPerformance = {
  boardId: string;
  boardName: string;
  acronym: string;
  attempts: number;
  correct: number;
  accuracy: number;
};

export type ContestPerformance = {
  contestId: string;
  contestName: string;
  year: number;
  attempts: number;
  correct: number;
  accuracy: number;
};

export type SubjectPerformance = {
  subjectId: string;
  subjectName: string;
  attempts: number;
  correct: number;
  accuracy: number;
};

export type TopicPerformance = {
  topicId: string;
  topicName: string;
  subjectName: string;
  attempts: number;
  correct: number;
  accuracy: number;
};

type BoardPerformanceRow = Omit<BoardPerformance, 'attempts' | 'correct'> & {
  attempts: bigint;
  correct: bigint;
};

type ContestPerformanceRow = Omit<ContestPerformance, 'attempts' | 'correct'> & {
  attempts: bigint;
  correct: bigint;
};

type SubjectPerformanceRow = Omit<SubjectPerformance, 'attempts' | 'correct'> & {
  attempts: bigint;
  correct: bigint;
};

type TopicPerformanceRow = Omit<TopicPerformance, 'attempts' | 'correct'> & {
  attempts: bigint;
  correct: bigint;
};

export async function getDashboardPerformance(userId: string) {
  const [boardRows, contestRows, subjectRows, topicRows] = await Promise.all([
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
      WHERE qa."userId" = ${userId}
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
      WHERE qa."userId" = ${userId}
        AND qa."selected" IS NOT NULL
      GROUP BY c."id", c."name", c."year"
      ORDER BY "attempts" DESC, "accuracy" ASC, c."year" DESC, c."name" ASC
      LIMIT 10
    `,
    prisma.$queryRaw<SubjectPerformanceRow[]>`
      SELECT
        s."id" AS "subjectId",
        s."name" AS "subjectName",
        COUNT(*)::bigint AS "attempts",
        SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::bigint AS "correct",
        ROUND(
          (SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100,
          1
        )::double precision AS "accuracy"
      FROM "QuestionAttempt" qa
      INNER JOIN "Question" q ON q."id" = qa."questionId"
      INNER JOIN "Subject" s ON s."id" = q."subjectId"
      WHERE qa."userId" = ${userId}
        AND qa."selected" IS NOT NULL
      GROUP BY s."id", s."name"
      ORDER BY "attempts" DESC, "accuracy" ASC, s."name" ASC
      LIMIT 10
    `,
    prisma.$queryRaw<TopicPerformanceRow[]>`
      SELECT
        t."id" AS "topicId",
        t."name" AS "topicName",
        s."name" AS "subjectName",
        COUNT(*)::bigint AS "attempts",
        SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::bigint AS "correct",
        ROUND(
          (SUM(CASE WHEN qa."correct" THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100,
          1
        )::double precision AS "accuracy"
      FROM "QuestionAttempt" qa
      INNER JOIN "Question" q ON q."id" = qa."questionId"
      INNER JOIN "Topic" t ON t."id" = q."topicId"
      INNER JOIN "Subject" s ON s."id" = t."subjectId"
      WHERE qa."userId" = ${userId}
        AND qa."selected" IS NOT NULL
      GROUP BY t."id", t."name", s."name"
      ORDER BY "attempts" DESC, "accuracy" ASC, s."name" ASC, t."name" ASC
      LIMIT 10
    `,
  ]);

  return {
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
    subjects: subjectRows.map((row) => ({
      subjectId: row.subjectId,
      subjectName: row.subjectName,
      attempts: Number(row.attempts),
      correct: Number(row.correct),
      accuracy: row.accuracy,
    })),
    topics: topicRows.map((row) => ({
      topicId: row.topicId,
      topicName: row.topicName,
      subjectName: row.subjectName,
      attempts: Number(row.attempts),
      correct: Number(row.correct),
      accuracy: row.accuracy,
    })),
  };
}
