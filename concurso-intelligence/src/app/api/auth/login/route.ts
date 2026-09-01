import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/auth';
import { getClientIp, hashClientIp, selectIpHashSecret } from '@/lib/client-ip';
import { consumeAuthRateLimit } from '@/lib/auth-rate-limit';

const schema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
});

const IP_HASH_RETENTION_DAYS = 90;
const IP_HASH_RETENTION_MS = IP_HASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const LOGIN_RATE_LIMIT = { scope: 'login', limit: 10, windowMs: 10 * 60 * 1000 };

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Credenciais inválidas.' }, { status: 400 });
  }

  const rateLimit = consumeAuthRateLimit(request, parsed.data.email, LOGIN_RATE_LIMIT);
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'retry-after': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
  }

  const ipHash = hashClientIp(
    getClientIp(request.headers, process.env.TRUSTED_IP_HEADER),
    selectIpHashSecret(process.env.IP_HASH_SECRET, process.env.SESSION_SECRET),
  );

  await prisma.$transaction([
    prisma.loginHistory.updateMany({
      where: {
        ipHash: { not: null },
        loggedAt: { lt: new Date(Date.now() - IP_HASH_RETENTION_MS) },
      },
      data: { ipHash: null },
    }),
    prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipHash,
        userAgent: request.headers.get('user-agent')?.slice(0, 500),
      },
    }),
  ]);
  await createSession(user.id);

  return NextResponse.json({ ok: true });
}
