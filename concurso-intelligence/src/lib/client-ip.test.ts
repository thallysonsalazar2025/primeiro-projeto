import assert from 'node:assert/strict';
import test from 'node:test';
import { getClientIp, hashClientIp, selectIpHashSecret } from './client-ip.ts';

test('uses x-forwarded-for only when explicitly trusted', () => {
  const headers = new Headers({
    'x-forwarded-for': '203.0.113.10, 10.0.0.2',
    'x-real-ip': '198.51.100.8',
  });

  assert.equal(getClientIp(headers, 'x-forwarded-for'), '203.0.113.10');
  assert.equal(getClientIp(headers, undefined), null);
});

test('uses x-real-ip only when explicitly trusted and trims whitespace', () => {
  const headers = new Headers({ 'x-real-ip': ' 198.51.100.8 ' });
  assert.equal(getClientIp(headers, 'x-real-ip'), '198.51.100.8');
});

test('rejects unsupported trusted header configuration', () => {
  const headers = new Headers({ 'x-forwarded-for': '203.0.113.10' });
  assert.equal(getClientIp(headers, 'forwarded'), null);
});

test('selects a non-empty dedicated secret and otherwise falls back to the session secret', () => {
  assert.equal(selectIpHashSecret('audit-secret', 'session-secret'), 'audit-secret');
  assert.equal(selectIpHashSecret('   ', 'session-secret'), 'session-secret');
  assert.equal(selectIpHashSecret(undefined, '  session-secret  '), 'session-secret');
  assert.equal(selectIpHashSecret(undefined, '  '), undefined);
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
