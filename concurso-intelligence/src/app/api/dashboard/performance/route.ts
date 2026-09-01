import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getDashboardPerformance } from "@/lib/dashboardPerformance";
import { getRecurrentQuestionErrors } from "@/lib/recurrentErrors";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [performance, recurrentErrors] = await Promise.all([
    getDashboardPerformance(user.id),
    getRecurrentQuestionErrors(user.id),
  ]);

  return NextResponse.json({ ...performance, recurrentErrors });
}
