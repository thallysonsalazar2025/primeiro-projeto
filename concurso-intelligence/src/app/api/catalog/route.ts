import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const [boards, contests, subjects] = await Promise.all([
    prisma.examBoard.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, acronym: true },
    }),
    prisma.contest.findMany({
      orderBy: [{ year: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        year: true,
        status: true,
        organization: { select: { id: true, name: true, acronym: true } },
        positions: {
          orderBy: { name: "asc" },
          select: { id: true, name: true, area: true, vacancies: true },
        },
      },
    }),
    prisma.subject.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        topics: {
          where: { parentId: null },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            children: {
              orderBy: { name: "asc" },
              select: { id: true, name: true },
            },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({ boards, contests, subjects });
}
