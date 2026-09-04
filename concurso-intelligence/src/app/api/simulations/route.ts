import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { selectSimulationQuestions, simulationModes } from "@/lib/simulation-mode";

const createSimulationSchema = z.object({
  boardId: z.string().min(1).optional(),
  contestId: z.string().min(1).optional(),
  positionId: z.string().min(1).optional(),
  subjectId: z.string().min(1).optional(),
  topicId: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(100).default(10),
  mode: z.enum(simulationModes).default("RANDOM"),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSimulationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid simulation filters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { boardId, contestId, positionId, subjectId, topicId, quantity, mode } = parsed.data;

  const candidates = await prisma.question.findMany({
    where: {
      status: { in: ["ACTIVE", "ANNULLED"] },
      ...(boardId ? { boardId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(topicId ? { topicId } : {}),
      ...((contestId || positionId)
        ? {
            exam: {
              ...(contestId ? { contestId } : {}),
              ...(positionId ? { positionId } : {}),
            },
          }
        : {}),
    },
    take: Math.max(quantity * 5, 100),
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

  if (candidates.length === 0) {
    return NextResponse.json({ error: "No questions found for the selected filters" }, { status: 404 });
  }

  const questions = selectSimulationQuestions(candidates, quantity, mode);
  const positionName = questions.find((question) => question.exam.position)?.exam.position?.name ?? null;

  const session = await prisma.studySession.create({
    data: {
      userId: user.id,
      boardId: boardId ?? questions[0]?.exam.board.id ?? null,
      positionName,
      questionIds: questions.map((question) => question.id),
    },
    select: { id: true, startedAt: true },
  });

  return NextResponse.json(
    {
      session: {
        id: session.id,
        startedAt: session.startedAt,
        requestedQuantity: quantity,
        questionCount: questions.length,
        mode,
      },
      questions,
    },
    { status: 201 },
  );
}
