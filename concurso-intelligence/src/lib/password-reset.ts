import { createHmac, timingSafeEqual } from 'node:crypto';

const RESET_TTL_SECONDS = 30 * 60;

type ResetPayload = {
  userId: string;
  expiresAt: number;
};

function secretFor(passwordHash: string) {
  const secret = process.env.PASSWORD_RESET_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) throw new Error('PASSWORD_RESET_SECRET or SESSION_SECRET must be configured');
  return `${secret}:${passwordHash}`;
}

function signature(value: string, passwordHash: string) {
  return createHmac('sha256', secretFor(passwordHash)).update(value).digest('base64url');
}

export function createPasswordResetToken(userId: string, passwordHash: string, now = Date.now()) {
  const payload: ResetPayload = {
    userId,
    expiresAt: Math.floor(now / 1000) + RESET_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signature(encoded, passwordHash)}`;
}

export function verifyPasswordResetToken(token: string, passwordHash: string, now = Date.now()): ResetPayload | null {
  const [encoded, providedSignature, ...rest] = token.split('.');
  if (!encoded || !providedSignature || rest.length) return null;

  const expectedSignature = signature(encoded, passwordHash);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ResetPayload;
    if (!payload.userId || !Number.isInteger(payload.expiresAt)) return null;
    if (payload.expiresAt < Math.floor(now / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
