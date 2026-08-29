import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nextReviewQuestionIds } from "@/lib/review-markers";
import { calculateSimulationResult } from "@/lib/simulation-result";

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

  const result = session.finishedAt
    ? calculateSimulationResult(session.questionIds.length, session.attempts)
    : null;

  let reviewByQuestionId: Record<string, { selected: string | null; correct: boolean | null; correctLabels: string[] }> | null = null;

  if (session.finishedAt) {
    const answerKeys = await prisma.question.findMany({
      where: { id: { in: session.questionIds } },
      select: {
        id: true,
        choices: {
          where: { isCorrect: true },
          orderBy: { label: "asc" },
          select: { label: true },
        },
      },
    });
    const attemptsById = new Map(session.attempts.map((attempt) => [attempt.questionId, attempt]));

    reviewByQuestionId = Object.fromEntries(
      answerKeys.map((question) => {
        const attempt = attemptsById.get(question.id);
        const correctLabels = question.choices.map((choice) => choice.label);
        const selected = attempt?.selected ?? null;
        return [
          question.id,
          {
            selected,
            correct: selected === null ? null : correctLabels.includes(selected),
            correctLabels,
          },
        ];
      }),
    );
  }

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
    result,
    reviewByQuestionId,
  });
}

async function updateReviewMarker(
  sessionId: string,
  userId: string,
  questionId: string,
  markedForReview: boolean,
) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const session = await tx.studySession.findFirst({
          where: { id: sessionId, userId },
          select: { id: true, finishedAt: true, questionIds: true, reviewQuestionIds: true },
        });

        if (!session) {
          return { kind: "not-found" as const };
        }

        if (session.finishedAt) {
          return { kind: "finished" as const };
        }

        if (!session.questionIds.includes(questionId)) {
          return { kind: "invalid-question" as const };
        }

        const reviewQuestionIds = nextReviewQuestionIds(
          session.reviewQuestionIds,
          questionId,
          markedForReview,
        );

        const updated = await tx.studySession.update({
          where: { id: session.id },
          data: { reviewQuestionIds },
          select: { reviewQuestionIds: true },
        });

        return { kind: "updated" as const, reviewQuestionIds: updated.reviewQuestionIds };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!retryable || attempt === maxAttempts) throw error;
    }
  }

  throw new Error("Could not update review marker");
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

  const result = await updateReviewMarker(sessionId, user.id, questionId, markedForReview);

  if (result.kind === "not-found") {
    return NextResponse.json({ error: "Simulation session not found" }, { status: 404 });
  }

  if (result.kind === "finished") {
    return NextResponse.json({ error: "Simulation session already finished" }, { status: 409 });
  }

  if (result.kind === "invalid-question") {
    return NextResponse.json({ error: "Question does not belong to this simulation" }, { status: 400 });
  }

  return NextResponse.json({ reviewQuestionIds: result.reviewQuestionIds });
}
