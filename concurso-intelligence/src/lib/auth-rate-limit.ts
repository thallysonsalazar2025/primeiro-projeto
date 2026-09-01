import { createHmac } from 'node:crypto';
import { getClientIp } from './client-ip.ts';
import { prisma } from './prisma.ts';

export type AuthRateLimitPolicy = {
  scope: string;
  limit: number;
  windowMs: number;
};

export type AuthRateLimitResult = {
  limited: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type AuthRateLimitStore = {
  consume: (key: string, policy: AuthRateLimitPolicy, now: number) => Promise<AuthRateLimitResult>;
};

type StoredBucket = {
  count: number;
  resetAt: Date;
};

let nextPruneAt = 0;
const PRUNE_INTERVAL_MS = 60_000;
const EXPIRED_BUCKET_RETENTION_MS = 24 * 60 * 60 * 1000;

async function consumeDatabaseBucket(
  key: string,
  policy: AuthRateLimitPolicy,
  now: number,
): Promise<AuthRateLimitResult> {
  const nowDate = new Date(now);
  const newResetAt = new Date(now + policy.windowMs);
  const rows = await prisma.$queryRaw<StoredBucket[]>`
    INSERT INTO "AuthRateLimitBucket" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${newResetAt}, ${nowDate})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "AuthRateLimitBucket"."resetAt" <= ${nowDate} THEN 1
        ELSE "AuthRateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "AuthRateLimitBucket"."resetAt" <= ${nowDate} THEN ${newResetAt}
        ELSE "AuthRateLimitBucket"."resetAt"
      END,
      "updatedAt" = ${nowDate}
    RETURNING "count", "resetAt"
  `;

  const bucket = rows[0];
  if (!bucket) throw new Error('Auth rate limit bucket was not persisted.');

  if (now >= nextPruneAt) {
    nextPruneAt = now + PRUNE_INTERVAL_MS;
    const pruneBefore = new Date(now - EXPIRED_BUCKET_RETENTION_MS);
    void prisma.$executeRaw`
      DELETE FROM "AuthRateLimitBucket"
      WHERE "resetAt" < ${pruneBefore}
    `.catch(() => undefined);
  }

  return {
    limited: bucket.count > policy.limit,
    remaining: Math.max(policy.limit - bucket.count, 0),
    retryAfterSeconds:
      bucket.count > policy.limit ? Math.max(Math.ceil((bucket.resetAt.getTime() - now) / 1000), 1) : 0,
  };
}

const databaseStore: AuthRateLimitStore = {
  consume: consumeDatabaseBucket,
};

export function createInMemoryAuthRateLimitStore(): AuthRateLimitStore {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return {
    async consume(key, policy, now) {
      const current = buckets.get(key);

      if (!current || current.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + policy.windowMs });
        return { limited: false, remaining: Math.max(policy.limit - 1, 0), retryAfterSeconds: 0 };
      }

      current.count += 1;
      return {
        limited: current.count > policy.limit,
        remaining: Math.max(policy.limit - current.count, 0),
        retryAfterSeconds:
          current.count > policy.limit ? Math.max(Math.ceil((current.resetAt - now) / 1000), 1) : 0,
      };
    },
  };
}

function hashKey(scope: string, dimension: 'identity' | 'ip', value: string, secret: string) {
  return createHmac('sha256', secret)
    .update(`${scope}\n${dimension}\n${value}`)
    .digest('hex');
}

function resolveSecret(explicitSecret?: string) {
  if (explicitSecret !== undefined) return explicitSecret.trim() || undefined;
  return process.env.AUTH_RATE_LIMIT_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || undefined;
}

export async function consumeAuthRateLimit(
  request: Request,
  identity: string,
  policy: AuthRateLimitPolicy,
  options?: { now?: number; secret?: string; store?: AuthRateLimitStore },
): Promise<AuthRateLimitResult> {
  const now = options?.now ?? Date.now();
  const secret = resolveSecret(options?.secret);

  if (!secret) {
    return { limited: false, remaining: policy.limit, retryAfterSeconds: 0 };
  }

  const store = options?.store ?? databaseStore;
  const normalizedIdentity = identity.trim().toLowerCase();
  const identityResult = await store.consume(hashKey(policy.scope, 'identity', normalizedIdentity, secret), policy, now);

  const ip = getClientIp(request.headers, process.env.TRUSTED_IP_HEADER);
  if (!ip) return identityResult;

  const ipResult = await store.consume(hashKey(policy.scope, 'ip', ip, secret), policy, now);
  return {
    limited: identityResult.limited || ipResult.limited,
    remaining: Math.min(identityResult.remaining, ipResult.remaining),
    retryAfterSeconds: Math.max(identityResult.retryAfterSeconds, ipResult.retryAfterSeconds),
  };
}
