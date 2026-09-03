import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/lib/auth';
import { consumeAuthRateLimit } from '@/lib/auth-rate-limit';
import { estimateForNewContest } from '@/lib/ranking';

const MAX_BODY_BYTES = 1_000_000;
const FUTURE_ESTIMATE_RATE_LIMIT = { scope: 'future-ranking-estimate', limit: 20, windowMs: 10 * 60 * 1000 };
const rankingCategorySchema = z.enum(['GENERAL', 'BLACK', 'PCD', 'OTHER_QUOTA']);

const rankingRowSchema = z.object({
  score: z.number().finite().min(0).max(100),
  rank: z.number().int().positive().nullable().optional(),
  category: rankingCategorySchema,
});

const historicalContestSchema = z.object({
  contestId: z.string().trim().min(1).max(128),
  board: z.string().trim().min(1).max(128),
  cargoFamily: z.string().trim().min(1).max(128).optional(),
  subjectSimilarity: z.number().finite().min(0).max(1),
  difficultySimilarity: z.number().finite().min(0).max(1).optional(),
  vacancySimilarity: z.number().finite().min(0).max(1).optional(),
  weight: z.number().finite().positive().optional(),
  rows: z.array(rankingRowSchema).min(20).max(5_000),
});

const requestSchema = z
  .object({
    simulatedScorePercent: z.number().finite().min(0).max(100),
    expectedCandidates: z.number().int().positive().max(10_000_000),
    targetBoard: z.string().trim().min(1).max(128),
    targetCargoFamily: z.string().trim().min(1).max(128).optional(),
    targetCategory: rankingCategorySchema,
    history: z.array(historicalContestSchema).min(1).max(20),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    value.history.forEach((contest, contestIndex) => {
      const normalizedId = contest.contestId.toLowerCase();
      if (ids.has(normalizedId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['history', contestIndex, 'contestId'],
          message: 'Historical contest IDs must be unique',
        });
      }
      ids.add(normalizedId);

      contest.rows.forEach((row, rowIndex) => {
        if (row.category !== value.targetCategory) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['history', contestIndex, 'rows', rowIndex, 'category'],
            message: 'Historical ranking category must match targetCategory',
          });
        }
      });
    });
  });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rateLimit = await consumeAuthRateLimit(request, user.id, FUTURE_ESTIMATE_RATE_LIMIT);
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: 'Muitas estimativas solicitadas. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'retry-after': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid future ranking estimate input' }, { status: 400 });
  }

  try {
    const estimate = estimateForNewContest(
      parsed.data.simulatedScorePercent,
      parsed.data.expectedCandidates,
      parsed.data.targetBoard,
      parsed.data.targetCargoFamily,
      parsed.data.history,
    );

    return NextResponse.json({
      estimate,
      assumptions: {
        expectedCandidates: parsed.data.expectedCandidates,
        targetBoard: parsed.data.targetBoard,
        targetCargoFamily: parsed.data.targetCargoFamily ?? null,
        targetCategory: parsed.data.targetCategory,
        historicalContests: parsed.data.history.length,
      },
      disclaimer: 'Projeção baseada em concursos históricos comparáveis; não representa classificação oficial nem garantia de posição.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to estimate ranking';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
