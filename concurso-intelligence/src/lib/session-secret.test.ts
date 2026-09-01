import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSessionSecret, sessionSecretBytes } from './session-secret';

test('rejects missing or blank SESSION_SECRET', () => {
  assert.throws(() => resolveSessionSecret(undefined), /SESSION_SECRET is required/);
  assert.throws(() => resolveSessionSecret('   '), /SESSION_SECRET is required/);
});

test('rejects SESSION_SECRET shorter than 32 characters', () => {
  assert.throws(() => resolveSessionSecret('short-secret'), /at least 32 characters/);
});

test('accepts and trims a strong SESSION_SECRET', () => {
  const value = '  0123456789abcdef0123456789abcdef  ';
  assert.equal(resolveSessionSecret(value), '0123456789abcdef0123456789abcdef');
  assert.equal(new TextDecoder().decode(sessionSecretBytes(value)), '0123456789abcdef0123456789abcdef');
});
