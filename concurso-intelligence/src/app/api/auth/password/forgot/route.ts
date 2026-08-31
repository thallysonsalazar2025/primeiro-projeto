import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createPasswordResetToken } from '@/lib/password-reset';

const schema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
});

const genericResponse = { ok: true, message: 'Se o e-mail estiver cadastrado, você receberá instruções para redefinir a senha.' };

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return NextResponse.json(genericResponse, { status: 202 });

  const token = createPasswordResetToken(user.id, user.passwordHash);
  const resetUrl = new URL('/reset-password', request.url);
  resetUrl.searchParams.set('token', token);

  const webhookUrl = process.env.PASSWORD_RESET_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.PASSWORD_RESET_WEBHOOK_SECRET
            ? { authorization: `Bearer ${process.env.PASSWORD_RESET_WEBHOOK_SECRET}` }
            : {}),
        },
        body: JSON.stringify({ email: user.email, resetUrl: resetUrl.toString(), expiresInMinutes: 30 }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      console.error('password-reset-delivery-failed', error instanceof Error ? error.message : 'unknown');
    }
  } else if (process.env.NODE_ENV !== 'production') {
    console.info('password-reset-development-link', resetUrl.toString());
  }

  return NextResponse.json(genericResponse, { status: 202 });
}
