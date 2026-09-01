import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSessionSecret, sessionSecretBytes } from './session-secret';

test('rejects missing SESSION_SECRET without depending on runner env', () => {
  const previous = process.env.SESSION_SECRET;
  delete process.env.SESSION_SECRET;
  try {
    assert.throws(() => resolveSessionSecret(), /SESSION_SECRET is required/);
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
});

test('rejects blank or short SESSION_SECRET', () => {
  assert.throws(() => resolveSessionSecret('   '), /SESSION_SECRET is required/);
  assert.throws(() => resolveSessionSecret('short-secret'), /at least 32 characters/);
});

test('accepts and trims a strong SESSION_SECRET', () => {
  const value = '  0123456789abcdef0123456789abcdef  ';
  assert.equal(resolveSessionSecret(value), '0123456789abcdef0123456789abcdef');
  assert.equal(new TextDecoder().decode(sessionSecretBytes(value)), '0123456789abcdef0123456789abcdef');
});
