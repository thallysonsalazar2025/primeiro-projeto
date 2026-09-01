import { createHmac } from 'node:crypto';
import { getClientIp } from './client-ip.ts';

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

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

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next().value as string | undefined;
    if (!oldest) break;
    buckets.delete(oldest);
  }
}

function keyFor(request: Request, identity: string, scope: string, secret: string) {
  const ip = getClientIp(request.headers, process.env.TRUSTED_IP_HEADER) ?? 'unknown-ip';
  return createHmac('sha256', secret)
    .update(`${scope}\n${ip}\n${identity.trim().toLowerCase()}`)
    .digest('hex');
}

export function consumeAuthRateLimit(
  request: Request,
  identity: string,
  policy: AuthRateLimitPolicy,
  options?: { now?: number; secret?: string },
): AuthRateLimitResult {
  const now = options?.now ?? Date.now();
  const secret = options?.secret ?? process.env.AUTH_RATE_LIMIT_SECRET ?? process.env.SESSION_SECRET;

  if (!secret?.trim()) {
    return { limited: false, remaining: policy.limit, retryAfterSeconds: 0 };
  }

  prune(now);
  const key = keyFor(request, identity, policy.scope, secret.trim());
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + policy.windowMs });
    return { limited: false, remaining: Math.max(policy.limit - 1, 0), retryAfterSeconds: 0 };
  }

  if (current.count >= policy.limit) {
    return {
      limited: true,
      remaining: 0,
      retryAfterSeconds: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
    };
  }

  current.count += 1;
  return { limited: false, remaining: Math.max(policy.limit - current.count, 0), retryAfterSeconds: 0 };
}

export function resetAuthRateLimitForTests() {
  buckets.clear();
}
