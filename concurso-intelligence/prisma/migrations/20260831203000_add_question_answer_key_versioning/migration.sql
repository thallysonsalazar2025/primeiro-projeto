CREATE TYPE "AnswerKeyKind" AS ENUM ('PRELIMINARY', 'FINAL');

CREATE TABLE "QuestionAnswerKey" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" "AnswerKeyKind" NOT NULL,
    "answer" TEXT,
    "isAnnulled" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionAnswerKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuestionAnswerKey_questionId_version_key"
ON "QuestionAnswerKey"("questionId", "version");

CREATE INDEX "QuestionAnswerKey_questionId_kind_version_idx"
ON "QuestionAnswerKey"("questionId", "kind", "version");

ALTER TABLE "QuestionAnswerKey"
ADD CONSTRAINT "QuestionAnswerKey_questionId_fkey"
FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
