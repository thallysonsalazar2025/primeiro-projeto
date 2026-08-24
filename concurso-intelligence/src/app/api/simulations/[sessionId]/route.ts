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
      canResume: session.finishedAt === null,
    },
    questions: orderedQuestions,
    attemptsByQuestionId,
  });
}
