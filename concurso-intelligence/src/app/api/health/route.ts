import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function uptimeSeconds() {
  return Math.max(0, Math.floor(process.uptime()));
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
