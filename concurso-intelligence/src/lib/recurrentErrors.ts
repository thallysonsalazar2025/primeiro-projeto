import { prisma } from '@/lib/prisma';

export type RecurrentQuestionError = {
  questionId: string;
  statement: string;
  subjectName: string | null;
  topicName: string | null;
  wrongAttempts: number;
  lastWrongAt: Date;
};

type RecurrentQuestionErrorRow = Omit<RecurrentQuestionError, 'wrongAttempts'> & {
  wrongAttempts: bigint;
};

export async function getRecurrentQuestionErrors(userId: string): Promise<RecurrentQuestionError[]> {
  const rows = await prisma.$queryRaw<RecurrentQuestionErrorRow[]>`
    SELECT
      q."id" AS "questionId",
      q."statement" AS "statement",
      s."name" AS "subjectName",
      t."name" AS "topicName",
      COUNT(*)::bigint AS "wrongAttempts",
      MAX(qa."answeredAt") AS "lastWrongAt"
    FROM "QuestionAttempt" qa
    INNER JOIN "Question" q ON q."id" = qa."questionId"
    LEFT JOIN "Subject" s ON s."id" = q."subjectId"
    LEFT JOIN "Topic" t ON t."id" = q."topicId"
    WHERE qa."userId" = ${userId}
      AND qa."selected" IS NOT NULL
      AND qa."correct" = false
    GROUP BY q."id", q."statement", s."name", t."name"
    HAVING COUNT(*) >= 2
    ORDER BY "wrongAttempts" DESC, "lastWrongAt" DESC, q."id" ASC
    LIMIT 10
  `;

  return rows.map((row) => ({
    ...row,
    wrongAttempts: Number(row.wrongAttempts),
  }));
}
