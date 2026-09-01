import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { sessionSecretBytes } from './session-secret';

const COOKIE = 'concurso_session';

export async function createSession(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  if (!user) throw new Error('User not found');

  const token = await new SignJWT({ userId, sessionVersion: user.sessionVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(sessionSecretBytes());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.set(COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionSecretBytes());
    const userId = String(payload.userId ?? '');
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, sessionVersion: true },
    });
    if (!user) return null;

    const tokenVersion = Number(payload.sessionVersion ?? 0);
    if (!Number.isInteger(tokenVersion) || tokenVersion !== user.sessionVersion) return null;

    return { id: user.id, email: user.email, name: user.name };
  } catch {
    return null;
  }
}
