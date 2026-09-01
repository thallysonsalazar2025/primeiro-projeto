-- Collapse any historical duplicates first, preserving the latest answer.
DELETE FROM "QuestionAttempt" older
USING "QuestionAttempt" newer
WHERE older."sessionId" IS NOT NULL
  AND newer."sessionId" = older."sessionId"
  AND newer."questionId" = older."questionId"
  AND (
    newer."answeredAt" > older."answeredAt"
    OR (newer."answeredAt" = older."answeredAt" AND newer."id" > older."id")
  );

-- Attempts outside a study session remain allowed to repeat; inside a session,
-- a question must have exactly one canonical answer row.
CREATE UNIQUE INDEX "QuestionAttempt_sessionId_questionId_key"
ON "QuestionAttempt"("sessionId", "questionId")
WHERE "sessionId" IS NOT NULL;
