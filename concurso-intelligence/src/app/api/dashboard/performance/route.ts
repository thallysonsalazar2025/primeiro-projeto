import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getDashboardPerformance } from "@/lib/dashboardPerformance";
import { getPerformanceHistory } from "@/lib/performanceHistory";
import { getRecurrentQuestionErrors } from "@/lib/recurrentErrors";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [performance, recurrentErrors, history] = await Promise.all([
    getDashboardPerformance(user.id),
    getRecurrentQuestionErrors(user.id),
    getPerformanceHistory(user.id),
  ]);

  return NextResponse.json({ ...performance, recurrentErrors, ...history });
}
