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

  const existing = await prisma.questionAttempt.findFirst({
    where: { sessionId, questionId, userId: user.id },
    select: { id: true },
  });

  const attempt = existing
    ? await prisma.questionAttempt.update({
        where: { id: existing.id },
        data: { selected, correct, elapsedMs, confidence, answeredAt: new Date() },
        select: { id: true, selected: true, correct: true, answeredAt: true, elapsedMs: true, confidence: true },
      })
    : await prisma.questionAttempt.create({
        data: {
          userId: user.id,
          sessionId,
          questionId,
          selected,
          correct,
          elapsedMs,
          confidence,
        },
        select: { id: true, selected: true, correct: true, answeredAt: true, elapsedMs: true, confidence: true },
      });

  return NextResponse.json({ attempt });
}
