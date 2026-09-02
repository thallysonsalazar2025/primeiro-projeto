-- Baseline da V2 antes das migrations incrementais.
-- Representa o schema existente em 2026-08-21 e permite `prisma migrate deploy`
-- em bancos vazios sem reescrever a história das migrations posteriores.

CREATE TYPE "ContestStatus" AS ENUM ('PLANNED', 'REGISTRATION_OPEN', 'EXAM_SCHEDULED', 'RESULTS_PENDING', 'RESULTS_PUBLISHED', 'CLOSED');
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE');
CREATE TYPE "QuestionStatus" AS ENUM ('ACTIVE', 'ANNULLED', 'OUTDATED', 'REVIEW_REQUIRED');
CREATE TYPE "SourceType" AS ENUM ('OFFICIAL_PDF', 'OFFICIAL_WEB', 'OPEN_DATASET', 'GITHUB_REPOSITORY', 'MANUAL');
CREATE TYPE "RankingCategory" AS ENUM ('GENERAL', 'BLACK', 'PCD', 'OTHER_QUOTA');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoginHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "LoginHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamBoard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "acronym" TEXT NOT NULL,
    "website" TEXT,
    CONSTRAINT "ExamBoard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "acronym" TEXT,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Contest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "organizationId" TEXT,
    "editalUrl" TEXT,
    "examDate" TIMESTAMP(3),
    "status" "ContestStatus" NOT NULL DEFAULT 'PLANNED',
    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContestPosition" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT,
    "vacancies" INTEGER,
    CONSTRAINT "ContestPosition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "contestId" TEXT,
    "boardId" TEXT NOT NULL,
    "organizationId" TEXT,
    "positionId" TEXT,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "examDate" TIMESTAMP(3),
    "sourceUrl" TEXT,
    "sourceDocument" TEXT,
    "sourceSha256" TEXT,
    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "subjectId" TEXT,
    "topicId" TEXT,
    "number" INTEGER,
    "statement" TEXT NOT NULL,
    "explanation" TEXT,
    "questionType" "QuestionType" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    "status" "QuestionStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceUrl" TEXT,
    "sourcePage" INTEGER,
    "sourceLabel" TEXT,
    "contentFingerprint" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3),
    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestionChoice" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "QuestionChoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestionProvenance" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "license" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceHash" TEXT,
    "notes" TEXT,
    CONSTRAINT "QuestionProvenance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "boardId" TEXT,
    "positionName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestionAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "questionId" TEXT NOT NULL,
    "selected" TEXT,
    "correct" BOOLEAN NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "elapsedMs" INTEGER,
    "confidence" INTEGER,
    CONSTRAINT "QuestionAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfficialRankingRow" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "positionId" TEXT,
    "candidateKey" TEXT NOT NULL,
    "score" DECIMAL(10,4) NOT NULL,
    "rank" INTEGER,
    "category" "RankingCategory" NOT NULL DEFAULT 'GENERAL',
    "sourceUrl" TEXT NOT NULL,
    "sourcePage" INTEGER,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OfficialRankingRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserContestTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "positionId" TEXT,
    "targetScore" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserContestTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "LoginHistory_userId_loggedAt_idx" ON "LoginHistory"("userId", "loggedAt");
CREATE UNIQUE INDEX "ExamBoard_acronym_key" ON "ExamBoard"("acronym");
CREATE UNIQUE INDEX "Contest_name_year_key" ON "Contest"("name", "year");
CREATE UNIQUE INDEX "ContestPosition_contestId_name_area_key" ON "ContestPosition"("contestId", "name", "area");
CREATE INDEX "Exam_boardId_year_idx" ON "Exam"("boardId", "year");
CREATE INDEX "Exam_contestId_positionId_idx" ON "Exam"("contestId", "positionId");
CREATE UNIQUE INDEX "Subject_name_key" ON "Subject"("name");
CREATE UNIQUE INDEX "Topic_subjectId_name_parentId_key" ON "Topic"("subjectId", "name", "parentId");
CREATE UNIQUE INDEX "Question_contentFingerprint_key" ON "Question"("contentFingerprint");
CREATE INDEX "Question_boardId_subjectId_topicId_idx" ON "Question"("boardId", "subjectId", "topicId");
CREATE INDEX "Question_examId_number_idx" ON "Question"("examId", "number");
CREATE UNIQUE INDEX "QuestionChoice_questionId_label_key" ON "QuestionChoice"("questionId", "label");
CREATE INDEX "QuestionProvenance_questionId_retrievedAt_idx" ON "QuestionProvenance"("questionId", "retrievedAt");
CREATE INDEX "QuestionAttempt_userId_answeredAt_idx" ON "QuestionAttempt"("userId", "answeredAt");
CREATE INDEX "QuestionAttempt_userId_questionId_idx" ON "QuestionAttempt"("userId", "questionId");
CREATE INDEX "OfficialRankingRow_contestId_positionId_category_score_idx" ON "OfficialRankingRow"("contestId", "positionId", "category", "score");
CREATE UNIQUE INDEX "UserContestTarget_userId_contestId_positionId_key" ON "UserContestTarget"("userId", "contestId", "positionId");

ALTER TABLE "LoginHistory" ADD CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contest" ADD CONSTRAINT "Contest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContestPosition" ADD CONSTRAINT "ContestPosition_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "ExamBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "ContestPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "ExamBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuestionChoice" ADD CONSTRAINT "QuestionChoice_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionProvenance" ADD CONSTRAINT "QuestionProvenance_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfficialRankingRow" ADD CONSTRAINT "OfficialRankingRow_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfficialRankingRow" ADD CONSTRAINT "OfficialRankingRow_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "ContestPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserContestTarget" ADD CONSTRAINT "UserContestTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserContestTarget" ADD CONSTRAINT "UserContestTarget_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
