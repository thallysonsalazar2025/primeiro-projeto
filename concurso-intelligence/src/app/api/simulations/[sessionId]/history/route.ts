import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { serializeAttemptHistory } from "@/lib/attempt-history";
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
      attempts: {
        orderBy: { answeredAt: "asc" },
        select: {
          id: true,
          selected: true,
          correct: true,
          answeredAt: true,
          elapsedMs: true,
          confidence: true,
          question: {
            select: {
              id: true,
              number: true,
              subject: { select: { id: true, name: true } },
              topic: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Simulation session not found" }, { status: 404 });
  }

  if (!session.finishedAt) {
    return NextResponse.json(
      { error: "Attempt history is available only after the simulation is finished" },
      { status: 409 },
    );
  }

  return NextResponse.json({
    session: {
      id: session.id,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
    },
    attempts: serializeAttemptHistory(session.attempts),
  });
}
