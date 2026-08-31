import assert from 'node:assert/strict';
import test from 'node:test';
import { createPasswordResetToken, verifyPasswordResetToken } from './password-reset';

process.env.PASSWORD_RESET_SECRET = 'test-reset-secret-with-enough-entropy';

const passwordHash = '$2a$12$original-hash';
const now = Date.UTC(2026, 7, 31, 10, 0, 0);

test('accepts a valid reset token within 30 minutes', () => {
  const token = createPasswordResetToken('user-1', passwordHash, now);
  const payload = verifyPasswordResetToken(token, passwordHash, now + 29 * 60 * 1000);
  assert.equal(payload?.userId, 'user-1');
});

test('rejects an expired reset token', () => {
  const token = createPasswordResetToken('user-1', passwordHash, now);
  assert.equal(verifyPasswordResetToken(token, passwordHash, now + 31 * 60 * 1000), null);
});

test('invalidates old tokens after password hash changes', () => {
  const token = createPasswordResetToken('user-1', passwordHash, now);
  assert.equal(verifyPasswordResetToken(token, '$2a$12$new-hash', now), null);
});

test('rejects tampered tokens', () => {
  const token = createPasswordResetToken('user-1', passwordHash, now);
  assert.equal(verifyPasswordResetToken(`${token}x`, passwordHash, now), null);
});
