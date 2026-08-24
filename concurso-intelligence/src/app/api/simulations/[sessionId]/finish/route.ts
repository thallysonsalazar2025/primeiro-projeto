import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId: user.id },
    select: {
      id: true,
      startedAt: true,
      finishedAt: true,
      questionIds: true,
      attempts: {
        orderBy: { answeredAt: "asc" },
        select: { questionId: true, correct: true, selected: true, elapsedMs: true },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Simulation session not found" }, { status: 404 });
  }

  const finishedAt = session.finishedAt ?? new Date();
  if (!session.finishedAt) {
    await prisma.studySession.update({
      where: { id: session.id },
      data: { finishedAt },
    });
  }

  const answeredAttempts = session.attempts.filter((attempt) => attempt.selected !== null);
  const answered = answeredAttempts.length;
  const correct = answeredAttempts.filter((attempt) => attempt.correct).length;
  const incorrect = answeredAttempts.filter((attempt) => !attempt.correct).length;
  const blank = Math.max(session.questionIds.length - answered, 0);
  const elapsedMs = session.attempts.reduce((total, attempt) => total + (attempt.elapsedMs ?? 0), 0);

  return NextResponse.json({
    session: {
      id: session.id,
      startedAt: session.startedAt,
      finishedAt,
    },
    result: {
      totalQuestions: session.questionIds.length,
      answered,
      correct,
      incorrect,
      blank,
      accuracy: answered === 0 ? 0 : correct / answered,
      elapsedMs,
    },
  });
}
