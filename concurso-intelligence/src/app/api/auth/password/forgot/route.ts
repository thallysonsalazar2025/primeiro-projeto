import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createPasswordResetToken } from '@/lib/password-reset';

const schema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
});

const genericResponse = { ok: true, message: 'Se o e-mail estiver cadastrado, você receberá instruções para redefinir a senha.' };
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const DELIVERY_TIMEOUT_MS = 350;
const RESPONSE_BUDGET_MS = 900;
const MAX_COOLDOWN_ENTRIES = 10_000;
const attempts = new Map<string, number>();

function publicOrigin(request: Request) {
  const configured = process.env.PUBLIC_APP_URL;
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      throw new Error('PUBLIC_APP_URL must use https in production');
    }
    return url.origin;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('PUBLIC_APP_URL is required in production');
  return new URL(request.url).origin;
}

async function waitUntil(startedAt: number, minimumMs: number) {
  const remaining = minimumMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

function pruneAttempts(now: number) {
  for (const [key, timestamp] of attempts) {
    if (now - timestamp >= RATE_LIMIT_WINDOW_MS) attempts.delete(key);
  }
  while (attempts.size > MAX_COOLDOWN_ENTRIES) {
    const oldestKey = attempts.keys().next().value as string | undefined;
    if (!oldestKey) break;
    attempts.delete(oldestKey);
  }
}

async function consumeEquivalentDeliveryBudget() {
  await new Promise((resolve) => setTimeout(resolve, DELIVERY_TIMEOUT_MS));
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  }

  const webhookUrl = process.env.PASSWORD_RESET_WEBHOOK_URL;
  if (process.env.NODE_ENV === 'production' && !webhookUrl) {
    console.error('password-reset-delivery-unconfigured');
    return NextResponse.json({ error: 'Recuperação de senha temporariamente indisponível.' }, { status: 503 });
  }

  pruneAttempts(startedAt);
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  if (!user) {
    await consumeEquivalentDeliveryBudget();
    await waitUntil(startedAt, RESPONSE_BUDGET_MS);
    return NextResponse.json(genericResponse, { status: 202 });
  }

  const lastAttempt = attempts.get(user.id) ?? 0;
  if (startedAt - lastAttempt < RATE_LIMIT_WINDOW_MS) {
    await consumeEquivalentDeliveryBudget();
    await waitUntil(startedAt, RESPONSE_BUDGET_MS);
    return NextResponse.json(genericResponse, { status: 202 });
  }
  attempts.set(user.id, startedAt);

  try {
    const resetUrl = new URL('/reset-password', publicOrigin(request));
    resetUrl.searchParams.set('token', createPasswordResetToken(user.id, user.passwordHash));

    if (webhookUrl) {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.PASSWORD_RESET_WEBHOOK_SECRET
            ? { authorization: `Bearer ${process.env.PASSWORD_RESET_WEBHOOK_SECRET}` }
            : {}),
        },
        body: JSON.stringify({ email: user.email, resetUrl: resetUrl.toString(), expiresInMinutes: 30 }),
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`password reset webhook returned ${response.status}`);
    } else {
      console.info('password-reset-development-link', resetUrl.toString());
      await consumeEquivalentDeliveryBudget();
    }
  } catch (error) {
    console.error('password-reset-delivery-failed', error instanceof Error ? error.message : 'unknown');
  }

  await waitUntil(startedAt, RESPONSE_BUDGET_MS);
  return NextResponse.json(genericResponse, { status: 202 });
}
