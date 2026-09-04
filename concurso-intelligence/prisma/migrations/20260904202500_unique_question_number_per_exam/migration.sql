-- Enforce the ingestion invariant at the database boundary as well as in the application validator.
-- PostgreSQL unique indexes allow multiple NULL values, so unnumbered questions remain valid.
DROP INDEX IF EXISTS "Question_examId_number_idx";

CREATE UNIQUE INDEX "Question_examId_number_key"
ON "Question"("examId", "number");
