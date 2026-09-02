import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const targetSchema = z.object({
  contestId: z.string().min(1),
  positionId: z.string().min(1),
  targetScore: z.number().finite().min(0).max(100000).nullable().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const targets = await prisma.userContestTarget.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      contest: { select: { id: true, name: true, year: true, editalUrl: true } },
    },
  });

  const positionIds = targets.flatMap((target) => (target.positionId ? [target.positionId] : []));
  const positions = positionIds.length
    ? await prisma.contestPosition.findMany({
        where: { id: { in: positionIds } },
        select: { id: true, name: true, area: true, vacancies: true },
      })
    : [];
  const positionById = new Map(positions.map((position) => [position.id, position]));

  return NextResponse.json({
    targets: targets.map((target) => ({
      id: target.id,
      contest: target.contest,
      position: target.positionId ? positionById.get(target.positionId) ?? null : null,
      targetScore: target.targetScore === null ? null : Number(target.targetScore),
      createdAt: target.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = targetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid preparation target' }, { status: 400 });
  }

  const { contestId, positionId, targetScore } = parsed.data;
  const position = await prisma.contestPosition.findFirst({
    where: { id: positionId, contestId },
    select: { id: true },
  });
  if (!position) {
    return NextResponse.json({ error: 'Position does not belong to contest' }, { status: 400 });
  }

  const data = { targetScore: targetScore ?? null };
  const existing = await prisma.userContestTarget.findFirst({
    where: { userId: user.id, contestId, positionId },
    select: { id: true },
  });

  let target;
  let created = false;
  if (existing) {
    target = await prisma.userContestTarget.update({ where: { id: existing.id }, data });
  } else {
    try {
      target = await prisma.userContestTarget.create({
        data: { userId: user.id, contestId, positionId, ...data },
      });
      created = true;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }

      const racedTarget = await prisma.userContestTarget.findFirst({
        where: { userId: user.id, contestId, positionId },
        select: { id: true },
      });
      if (!racedTarget) throw error;
      target = await prisma.userContestTarget.update({ where: { id: racedTarget.id }, data });
    }
  }

  return NextResponse.json({
    target: {
      id: target.id,
      contestId: target.contestId,
      positionId: target.positionId,
      targetScore: target.targetScore === null ? null : Number(target.targetScore),
    },
  }, { status: created ? 201 : 200 });
}
