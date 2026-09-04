-- Enforce the ingestion invariant at the database boundary as well as in the application validator.
-- PostgreSQL unique indexes allow multiple NULL values, so unnumbered questions remain valid.
-- Historical databases may contain repeated non-null numbers because the previous schema allowed them.
-- Preserve every row by keeping the oldest canonical number and clearing the conflicting legacy copies.
WITH ranked_duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "examId", "number"
      ORDER BY "createdAt" ASC, id ASC
    ) AS duplicate_rank
  FROM "Question"
  WHERE "number" IS NOT NULL
)
UPDATE "Question" AS q
SET "number" = NULL
FROM ranked_duplicates AS ranked
WHERE q.id = ranked.id
  AND ranked.duplicate_rank > 1;

DROP INDEX IF EXISTS "Question_examId_number_idx";

CREATE UNIQUE INDEX "Question_examId_number_key"
ON "Question"("examId", "number");
