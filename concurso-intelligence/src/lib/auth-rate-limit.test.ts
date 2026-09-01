import assert from 'node:assert/strict';
import test from 'node:test';
import { consumeAuthRateLimit, resetAuthRateLimitForTests } from './auth-rate-limit.ts';

const policy = { scope: 'login', limit: 3, windowMs: 60_000 };

function request(ip = '203.0.113.10') {
  return new Request('http://localhost/api/auth/login', {
    headers: { 'x-forwarded-for': ip },
  });
}

test.beforeEach(() => {
  resetAuthRateLimitForTests();
  process.env.TRUSTED_IP_HEADER = 'x-forwarded-for';
});

test('limits repeated attempts for the same identity and client', () => {
  assert.equal(consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 1_000, secret: 'secret' }).limited, false);
  assert.equal(consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 2_000, secret: 'secret' }).limited, false);
  assert.equal(consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 3_000, secret: 'secret' }).limited, false);

  const blocked = consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 4_000, secret: 'secret' });
  assert.equal(blocked.limited, true);
  assert.equal(blocked.retryAfterSeconds, 57);
});

test('separates buckets by identity and trusted client IP', () => {
  for (let i = 0; i < 3; i += 1) {
    consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 1_000 + i, secret: 'secret' });
  }

  assert.equal(consumeAuthRateLimit(request('198.51.100.8'), 'user@example.com', policy, { now: 5_000, secret: 'secret' }).limited, false);
  assert.equal(consumeAuthRateLimit(request(), 'other@example.com', policy, { now: 5_000, secret: 'secret' }).limited, false);
});

test('opens a fresh window after expiration', () => {
  for (let i = 0; i < 3; i += 1) {
    consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 1_000 + i, secret: 'secret' });
  }

  assert.equal(consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 61_001, secret: 'secret' }).limited, false);
});

test('fails open when no secret is configured', () => {
  const result = consumeAuthRateLimit(request(), 'user@example.com', policy, { now: 1_000, secret: '' });
  assert.equal(result.limited, false);
  assert.equal(result.remaining, policy.limit);
});
