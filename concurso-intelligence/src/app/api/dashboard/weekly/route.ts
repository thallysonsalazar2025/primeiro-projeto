import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { getDashboardWeeklyPerformance } from '@/lib/dashboardWeeklyPerformance';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ weeks: await getDashboardWeeklyPerformance(user.id) });
}
