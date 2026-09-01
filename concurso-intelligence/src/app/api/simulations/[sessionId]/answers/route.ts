import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const answerSchema = z.object({
  questionId: z.string().min(1),
  selected: z.string().min(1).nullable(),
  elapsedMs: z.number().int().min(0).optional(),
  confidence: z.number().int().min(1).max(5).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const parsed = answerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid answer", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId: user.id },
    select: { id: true, finishedAt: true, questionIds: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Simulation session not found" }, { status: 404 });
  }
  if (session.finishedAt) {
    return NextResponse.json({ error: "Simulation session is already finished" }, { status: 409 });
  }

  const { questionId, selected, elapsedMs, confidence } = parsed.data;
  if (!session.questionIds.includes(questionId)) {
    return NextResponse.json({ error: "Question does not belong to this simulation" }, { status: 400 });
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      status: true,
      choices: { select: { label: true, isCorrect: true } },
    },
  });
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const selectedChoice = selected
    ? question.choices.find((choice) => choice.label === selected)
    : null;
  if (selected && !selectedChoice) {
    return NextResponse.json({ error: "Selected choice does not belong to question" }, { status: 400 });
  }

  const correct = question.status === "ANNULLED" ? true : Boolean(selectedChoice?.isCorrect);
  // Capture the submission timestamp before waiting for the advisory lock. A request
  // that started earlier must not overwrite a newer answer just because it acquires
  // the lock later after scheduler/network delay.
  const answeredAt = new Date();
  const lockKey = `${sessionId}:${questionId}`;

  const attempt = await prisma.$transaction(async (tx) => {
    // Serialize writes for this exact session/question pair without introducing a
    // nullable compound unique constraint that Prisma cannot represent safely.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text`;

    const existing = await tx.questionAttempt.findMany({
      where: { sessionId, questionId, userId: user.id },
      orderBy: [{ answeredAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        selected: true,
        correct: true,
        answeredAt: true,
        elapsedMs: true,
        confidence: true,
      },
    });

    const data = { selected, correct, elapsedMs, confidence, answeredAt };
    if (existing.length === 0) {
      return tx.questionAttempt.create({
        data: {
          userId: user.id,
          sessionId,
          questionId,
          ...data,
        },
        select: {
          id: true,
          selected: true,
          correct: true,
          answeredAt: true,
          elapsedMs: true,
          confidence: true,
        },
      });
    }

    const [canonical, ...duplicates] = existing;
    if (duplicates.length > 0) {
      await tx.questionAttempt.deleteMany({
        where: { id: { in: duplicates.map(({ id }) => id) } },
      });
    }

    // The lock prevents duplicate rows; this timestamp guard additionally prevents
    // an older delayed request from replacing a newer submission already persisted.
    if (canonical.answeredAt > answeredAt) {
      return canonical;
    }

    return tx.questionAttempt.update({
      where: { id: canonical.id },
      data,
      select: {
        id: true,
        selected: true,
        correct: true,
        answeredAt: true,
        elapsedMs: true,
        confidence: true,
      },
    });
  });

  return NextResponse.json({ attempt });
}
