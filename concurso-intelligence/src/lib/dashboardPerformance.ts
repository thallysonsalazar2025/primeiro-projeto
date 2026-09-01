import { prisma } from '@/lib/prisma';

export type StudySignal = 'insufficient' | 'weak' | 'stable' | 'strong';

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
  signal: StudySignal;
};

export type TopicPerformance = {
  topicId: string;
  topicName: string;
  parentName: string | null;
  subjectName: string;
  attempts: number;
  correct: number;
  accuracy: number;
  signal: StudySignal;
};

type BoardPerformanceRow = Omit<BoardPerformance, 'attempts' | 'correct'> & {
  attempts: bigint;
  correct: bigint;
};

type ContestPerformanceRow = Omit<ContestPerformance, 'attempts' | 'correct'> & {
  attempts: bigint;
  correct: bigint;
};

type SubjectPerformanceRow = Omit<SubjectPerformance, 'attempts' | 'correct' | 'signal'> & {
  attempts: bigint;
  correct: bigint;
};

type TopicPerformanceRow = Omit<TopicPerformance, 'attempts' | 'correct' | 'signal'> & {
  attempts: bigint;
  correct: bigint;
};

const MIN_ATTEMPTS_FOR_SIGNAL = 5;

export function classifyStudySignal(attempts: number, accuracy: number): StudySignal {
  if (attempts < MIN_ATTEMPTS_FOR_SIGNAL) return 'insufficient';
  if (accuracy < 60) return 'weak';
  if (accuracy >= 80) return 'strong';
  return 'stable';
}

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
        p."name" AS "parentName",
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
      LEFT JOIN "Topic" p ON p."id" = t."parentId"
      INNER JOIN "Subject" s ON s."id" = t."subjectId"
      WHERE qa."userId" = ${userId}
        AND qa."selected" IS NOT NULL
      GROUP BY t."id", t."name", p."name", s."name"
      ORDER BY "attempts" DESC, "accuracy" ASC, s."name" ASC, p."name" ASC NULLS FIRST, t."name" ASC
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
    subjects: subjectRows.map((row) => {
      const attempts = Number(row.attempts);
      return {
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        attempts,
        correct: Number(row.correct),
        accuracy: row.accuracy,
        signal: classifyStudySignal(attempts, row.accuracy),
      };
    }),
    topics: topicRows.map((row) => {
      const attempts = Number(row.attempts);
      return {
        topicId: row.topicId,
        topicName: row.topicName,
        parentName: row.parentName,
        subjectName: row.subjectName,
        attempts,
        correct: Number(row.correct),
        accuracy: row.accuracy,
        signal: classifyStudySignal(attempts, row.accuracy),
      };
    }),
  };
}
