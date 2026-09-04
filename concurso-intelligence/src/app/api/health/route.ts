import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { structuredLog } from '@/lib/structured-log';

export const dynamic = 'force-dynamic';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function uptimeSeconds() {
  return Math.max(0, Math.floor(process.uptime()));
}

function resolveRequestId(request: Request) {
  const candidate = request.headers.get('x-request-id')?.trim();
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

export async function GET(request: Request) {
  const checkedAt = new Date().toISOString();
  const requestId = resolveRequestId(request);
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
