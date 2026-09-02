import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const startedAt = Date.now();

function uptimeSeconds() {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  const databaseStartedAt = performance.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    const databaseLatencyMs = Math.max(0, Math.round(performance.now() - databaseStartedAt));

    return NextResponse.json(
      {
        status: 'ok',
        checkedAt,
        uptimeSeconds: uptimeSeconds(),
        checks: {
          database: {
            status: 'ok',
            latencyMs: databaseLatencyMs,
          },
        },
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch {
    const databaseLatencyMs = Math.max(0, Math.round(performance.now() - databaseStartedAt));

    return NextResponse.json(
      {
        status: 'degraded',
        checkedAt,
        uptimeSeconds: uptimeSeconds(),
        checks: {
          database: {
            status: 'unavailable',
            latencyMs: databaseLatencyMs,
          },
        },
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
