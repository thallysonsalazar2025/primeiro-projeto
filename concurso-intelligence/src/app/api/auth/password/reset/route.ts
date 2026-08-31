import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPasswordResetToken } from '@/lib/password-reset';

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const [encoded] = parsed.data.token.split('.');
  let userId = '';
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as { userId?: string };
    userId = payload.userId ?? '';
  } catch {
    return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 400 });
  }

  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  if (!user || !verifyPasswordResetToken(parsed.data.token, user.passwordHash)) {
    return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
