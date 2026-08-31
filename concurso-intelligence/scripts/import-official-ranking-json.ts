import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { assertNoDuplicateRankingRows, parseOfficialRankingImport } from '../src/lib/official-ranking-import.ts';

const prisma = new PrismaClient();

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error('Uso: npm run db:import:ranking -- caminho/arquivo.json');

  const payload = parseOfficialRankingImport(JSON.parse(await readFile(inputPath, 'utf8')));
  assertNoDuplicateRankingRows(payload);

  const contest = await prisma.contest.findUnique({ where: { id: payload.contestId } });
  if (!contest) throw new Error(`Concurso não encontrado: ${payload.contestId}`);

  if (payload.positionId) {
    const position = await prisma.contestPosition.findFirst({
      where: { id: payload.positionId, contestId: payload.contestId },
      select: { id: true },
    });
    if (!position) throw new Error(`Cargo não pertence ao concurso: ${payload.positionId}`);
  }

  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of payload.rows) {
      const identity = {
        contestId: payload.contestId,
        positionId: payload.positionId ?? null,
        candidateKey: row.candidateKey.trim(),
        category: row.category,
      } as const;

      const existing = await tx.officialRankingRow.findFirst({
        where: identity,
        select: { id: true },
      });

      const data = {
        ...identity,
        score: row.score,
        rank: row.rank ?? null,
        sourceUrl: payload.sourceUrl,
        sourcePage: payload.sourcePage ?? null,
      };

      if (existing) {
        await tx.officialRankingRow.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await tx.officialRankingRow.create({ data });
        created += 1;
      }
    }
  });

  console.log(JSON.stringify({ contestId: payload.contestId, positionId: payload.positionId ?? null, created, updated, total: payload.rows.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
