import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/auth';
import { consumeAuthRateLimit } from '@/lib/auth-rate-limit';
import { resolveSessionSecret } from '@/lib/session-secret';

const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(128),
});

const REGISTER_RATE_LIMIT = { scope: 'register', limit: 5, windowMs: 60 * 60 * 1000 };

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  resolveSessionSecret();

  const rateLimit = await consumeAuthRateLimit(request, parsed.data.email, REGISTER_RATE_LIMIT);
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' },
      { status: 429, headers: { 'retry-after': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: 'E-mail já cadastrado.' }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
    },
  });

  await prisma.loginHistory.create({
    data: {
      userId: user.id,
      userAgent: request.headers.get('user-agent')?.slice(0, 500),
    },
  });
  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
