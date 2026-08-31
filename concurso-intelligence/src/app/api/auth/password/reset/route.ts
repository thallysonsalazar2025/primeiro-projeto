import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPasswordResetToken } from '@/lib/password-reset';

const passwordSchema = z.string().min(8).max(128).refine(
  (value) => Buffer.byteLength(value, 'utf8') <= 72,
  { message: 'A senha deve ter no máximo 72 bytes em UTF-8.' },
);

const schema = z.object({
  token: z.string().min(20).max(4096),
  password: passwordSchema,
});

const invalidLink = () => NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 400 });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const [encoded] = parsed.data.token.split('.');
  let userId = '';
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as { userId?: unknown };
    userId = typeof payload.userId === 'string' ? payload.userId : '';
  } catch {
    return invalidLink();
  }

  if (!userId) return invalidLink();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !verifyPasswordResetToken(parsed.data.token, user.passwordHash)) {
    return invalidLink();
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const updated = await prisma.user.updateMany({
    where: { id: user.id, passwordHash: user.passwordHash },
    data: {
      passwordHash,
      sessionVersion: { increment: 1 },
    },
  });

  if (updated.count !== 1) return invalidLink();

  return NextResponse.json({ ok: true });
}
