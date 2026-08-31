import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RankingEstimator } from './RankingEstimator';

export default async function RankingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const rankingGroups = await prisma.officialRankingRow.groupBy({
    by: ['contestId', 'positionId', 'category'],
    orderBy: [{ contestId: 'asc' }, { positionId: 'asc' }, { category: 'asc' }],
  });

  const contestIds = Array.from(new Set(rankingGroups.map((row) => row.contestId)));
  const positionIds = Array.from(new Set(rankingGroups.map((row) => row.positionId)));

  const [contestRows, positionRows] = await Promise.all([
    prisma.contest.findMany({
      where: { id: { in: contestIds } },
      select: { id: true, name: true, year: true },
    }),
    prisma.contestPosition.findMany({
      where: { id: { in: positionIds } },
      select: { id: true, contestId: true, name: true, area: true },
    }),
  ]);

  const contestById = new Map(contestRows.map((contest) => [contest.id, contest]));
  const positionById = new Map(positionRows.map((position) => [position.id, position]));
  const contests = new Map<string, {
    id: string;
    name: string;
    year: number;
    positions: Map<string, { id: string; name: string; area: string | null; categories: Set<string> }>;
  }>();

  for (const group of rankingGroups) {
    const contestRow = contestById.get(group.contestId);
    const positionRow = positionById.get(group.positionId);
    if (!contestRow || !positionRow || positionRow.contestId !== contestRow.id) continue;

    const contest = contests.get(contestRow.id) ?? {
      id: contestRow.id,
      name: contestRow.name,
      year: contestRow.year,
      positions: new Map(),
    };
    const position = contest.positions.get(positionRow.id) ?? {
      id: positionRow.id,
      name: positionRow.name,
      area: positionRow.area,
      categories: new Set<string>(),
    };
    position.categories.add(group.category);
    contest.positions.set(position.id, position);
    contests.set(contest.id, contest);
  }

  const options = Array.from(contests.values()).map((contest) => ({
    id: contest.id,
    name: contest.name,
    year: contest.year,
    positions: Array.from(contest.positions.values()).map((position) => ({
      id: position.id,
      name: position.name,
      area: position.area,
      categories: Array.from(position.categories),
    })),
  }));

  return (
    <main style={{ minHeight: '100vh', background: '#f8fafc', padding: 24 }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <nav style={{ marginBottom: 20 }}>
          <Link href="/dashboard" style={{ color: '#4f46e5', fontWeight: 700 }}>← Voltar ao dashboard</Link>
        </nav>
        <header style={{ marginBottom: 22 }}>
          <p style={{ color: '#4f46e5', fontWeight: 800, margin: 0 }}>Concurso Intelligence</p>
          <h1 style={{ margin: '6px 0 8px' }}>Estimador de classificação</h1>
          <p style={{ margin: 0, color: '#64748b' }}>
            Compare sua pontuação simulada com resultados oficiais já importados. A projeção é uma referência estatística e nunca substitui o resultado publicado pelo órgão.
          </p>
        </header>
        <RankingEstimator contests={options} />
      </div>
    </main>
  );
}
