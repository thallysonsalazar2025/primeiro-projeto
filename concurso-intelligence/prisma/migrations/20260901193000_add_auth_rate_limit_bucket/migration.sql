CREATE TABLE "AuthRateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthRateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "AuthRateLimitBucket_resetAt_idx" ON "AuthRateLimitBucket"("resetAt");
