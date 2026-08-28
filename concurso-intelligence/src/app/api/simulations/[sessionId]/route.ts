import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
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
      boardId: true,
      positionName: true,
      questionIds: true,
      reviewQuestionIds: true,
      attempts: {
        orderBy: { answeredAt: "asc" },
        select: {
          questionId: true,
          selected: true,
          correct: true,
          answeredAt: true,
          elapsedMs: true,
          confidence: true,
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Simulation session not found" }, { status: 404 });
  }

  const questions = await prisma.question.findMany({
    where: { id: { in: session.questionIds } },
    select: {
      id: true,
      number: true,
      statement: true,
      questionType: true,
      status: true,
      subject: { select: { id: true, name: true } },
      topic: { select: { id: true, name: true } },
      exam: {
        select: {
          id: true,
          title: true,
          year: true,
          board: { select: { id: true, name: true, acronym: true } },
          contest: { select: { id: true, name: true, year: true } },
          position: { select: { id: true, name: true, area: true } },
        },
      },
      choices: {
        orderBy: { label: "asc" },
        select: { id: true, label: true, text: true },
      },
    },
  });

  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const orderedQuestions = session.questionIds
    .map((questionId) => questionsById.get(questionId))
    .filter((question): question is NonNullable<typeof question> => Boolean(question));

  const attemptsByQuestionId = Object.fromEntries(
    session.attempts.map((attempt) => [
      attempt.questionId,
      {
        selected: attempt.selected,
        answeredAt: attempt.answeredAt,
        elapsedMs: attempt.elapsedMs,
        confidence: attempt.confidence,
      },
    ]),
  );

  return NextResponse.json({
    session: {
      id: session.id,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      boardId: session.boardId,
      positionName: session.positionName,
      questionCount: session.questionIds.length,
      answeredCount: session.attempts.filter((attempt) => attempt.selected !== null).length,
      reviewQuestionIds: session.reviewQuestionIds,
      canResume: session.finishedAt === null,
    },
    questions: orderedQuestions,
    attemptsByQuestionId,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const payload = await request.json().catch(() => null) as { questionId?: unknown; markedForReview?: unknown } | null;
  const questionId = typeof payload?.questionId === "string" ? payload.questionId : "";
  const markedForReview = payload?.markedForReview;

  if (!questionId || typeof markedForReview !== "boolean") {
    return NextResponse.json({ error: "questionId and markedForReview are required" }, { status: 400 });
  }

  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId: user.id },
    select: { id: true, finishedAt: true, questionIds: true, reviewQuestionIds: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Simulation session not found" }, { status: 404 });
  }

  if (session.finishedAt) {
    return NextResponse.json({ error: "Simulation session already finished" }, { status: 409 });
  }

  if (!session.questionIds.includes(questionId)) {
    return NextResponse.json({ error: "Question does not belong to this simulation" }, { status: 400 });
  }

  const reviewQuestionIds = markedForReview
    ? Array.from(new Set([...session.reviewQuestionIds, questionId]))
    : session.reviewQuestionIds.filter((id) => id !== questionId);

  const updated = await prisma.studySession.update({
    where: { id: session.id },
    data: { reviewQuestionIds },
    select: { reviewQuestionIds: true },
  });

  return NextResponse.json({ reviewQuestionIds: updated.reviewQuestionIds });
}
