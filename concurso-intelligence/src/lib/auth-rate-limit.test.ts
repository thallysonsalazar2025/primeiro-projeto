import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeAuthRateLimit, createInMemoryAuthRateLimitStore } from './auth-rate-limit.ts';

const policy = { scope: 'login', limit: 3, windowMs: 60_000 };

function request(ip = '203.0.113.10') {
  return new Request('http://localhost/api/auth/login', {
    headers: { 'x-forwarded-for': ip },
  });
}

let store = createInMemoryAuthRateLimitStore();

test.beforeEach(() => {
  store = createInMemoryAuthRateLimitStore();
  process.env.TRUSTED_IP_HEADER = 'x-forwarded-for';
  delete process.env.AUTH_RATE_LIMIT_SECRET;
  delete process.env.SESSION_SECRET;
});

test('limits repeated attempts for the same identity and client', async () => {
  assert.equal((await consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 1_000, secret: 'secret', store })).limited, false);
  assert.equal((await consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 2_000, secret: 'secret', store })).limited, false);
  assert.equal((await consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 3_000, secret: 'secret', store })).limited, false);

  const blocked = await consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 4_000, secret: 'secret', store });
  assert.equal(blocked.limited, true);
  assert.equal(blocked.retryAfterSeconds, 57);
});

test('blocks one identity even when the trusted client IP rotates', async () => {
  await consumeAuthRateLimit(request('203.0.113.1'), 'user@example.com', policy, { now: 1_000, secret: 'secret', store });
  await consumeAuthRateLimit(request('203.0.113.2'), 'user@example.com', policy, { now: 2_000, secret: 'secret', store });
  await consumeAuthRateLimit(request('203.0.113.3'), 'user@example.com', policy, { now: 3_000, secret: 'secret', store });

  assert.equal(
    (await consumeAuthRateLimit(request('203.0.113.4'), 'user@example.com', policy, { now: 4_000, secret: 'secret', store })).limited,
    true,
  );
});

test('blocks one trusted client IP even when identities rotate', async () => {
  await consumeAuthRateLimit(request(), 'one@example.com', policy, { now: 1_000, secret: 'secret', store });
  await consumeAuthRateLimit(request(), 'two@example.com', policy, { now: 2_000, secret: 'secret', store });
  await consumeAuthRateLimit(request(), 'three@example.com', policy, { now: 3_000, secret: 'secret', store });

  assert.equal(
    (await consumeAuthRateLimit(request(), 'four@example.com', policy, { now: 4_000, secret: 'secret', store })).limited,
    true,
  );
});

test('opens a fresh window after expiration', async () => {
  for (let i = 0; i < 3; i += 1) {
    await consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 1_000 + i, secret: 'secret', store });
  }

  assert.equal((await consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 61_001, secret: 'secret', store })).limited, false);
});

test('falls back to SESSION_SECRET when dedicated secret is blank', async () => {
  process.env.AUTH_RATE_LIMIT_SECRET = '   ';
  process.env.SESSION_SECRET = 'session-secret';

  await consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 1_000, store });
  await consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 2_000, store });
  await consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 3_000, store });

  assert.equal((await consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 4_000, store })).limited, true);
});

test('fails open when no secret is configured', async () => {
  const result = await consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 1_000, secret: '', store });
  assert.equal(result.limited, false);
  assert.equal(result.remaining, policy.limit);
});
