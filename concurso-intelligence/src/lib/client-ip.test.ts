import assert from 'node:assert/strict';
import test from 'node:test';
import { getClientIp, hashClientIp } from './client-ip.ts';

test('prefers the first forwarded client address', () => {
  const headers = new Headers({
    'x-forwarded-for': '203.0.113.10, 10.0.0.2',
    'x-real-ip': '198.51.100.8',
  });

  assert.equal(getClientIp(headers), '203.0.113.10');
});

test('falls back to x-real-ip and trims whitespace', () => {
  const headers = new Headers({ 'x-real-ip': ' 198.51.100.8 ' });
  assert.equal(getClientIp(headers), '198.51.100.8');
});

test('returns null when no client IP header is available', () => {
  assert.equal(getClientIp(new Headers()), null);
});

test('creates deterministic keyed hashes without storing the raw IP', () => {
  const hash = hashClientIp('203.0.113.10', 'audit-secret');
  assert.equal(hash, hashClientIp('203.0.113.10', 'audit-secret'));
  assert.notEqual(hash, hashClientIp('203.0.113.10', 'another-secret'));
  assert.equal(hash?.includes('203.0.113.10'), false);
});

test('does not create an unkeyed hash', () => {
  assert.equal(hashClientIp('203.0.113.10', undefined), null);
  assert.equal(hashClientIp(null, 'audit-secret'), null);
});
