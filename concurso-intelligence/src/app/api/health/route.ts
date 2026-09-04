import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { structuredLog } from '@/lib/structured-log';

export const dynamic = 'force-dynamic';

function uptimeSeconds() {
  return Math.max(0, Math.floor(process.uptime()));
}

export async function GET(request: Request) {
  const checkedAt = new Date().toISOString();
  const requestId = request.headers.get('x-request-id')?.trim().slice(0, 128) || randomUUID();
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
        headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId },
      },
    );
  } catch (error) {
    const databaseLatencyMs = Math.max(0, Math.round(performance.now() - databaseStartedAt));
    structuredLog('error', 'health.database.degraded', {
      requestId,
      databaseLatencyMs,
      error,
    });

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
        headers: { 'Cache-Control': 'no-store', 'x-request-id': requestId },
      },
    );
  }
}
