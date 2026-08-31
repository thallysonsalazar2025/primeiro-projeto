import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { assertNoDuplicateRankingRows, parseOfficialRankingImport } from '../src/lib/official-ranking-import.ts';

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) throw new Error('Uso: npm run db:import:ranking -- caminho/arquivo.json');

  const payload = parseOfficialRankingImport(JSON.parse(await readFile(inputPath, 'utf8')));
  assertNoDuplicateRankingRows(payload);

  const contest = await prisma.contest.findUnique({ where: { id: payload.contestId }, select: { id: true } });
  if (!contest) throw new Error(`Concurso não encontrado: ${payload.contestId}`);

  const position = await prisma.contestPosition.findFirst({
    where: { id: payload.positionId, contestId: payload.contestId },
    select: { id: true },
  });
  if (!position) throw new Error(`Cargo não pertence ao concurso: ${payload.positionId}`);

  let processed = 0;
  const importedAt = new Date();

  for (let offset = 0; offset < payload.rows.length; offset += BATCH_SIZE) {
    const batch = payload.rows.slice(offset, offset + BATCH_SIZE);
    await Promise.all(batch.map((row) => {
      const identity = {
        contestId: payload.contestId,
        positionId: payload.positionId,
        candidateKey: row.candidateKey,
        category: row.category,
      } as const;

      const data = {
        score: row.score,
        rank: row.rank ?? null,
        sourceUrl: payload.sourceUrl,
        sourcePage: row.sourcePage ?? payload.sourcePage ?? null,
        importedAt,
      };

      return prisma.officialRankingRow.upsert({
        where: { contestId_positionId_candidateKey_category: identity },
        create: { ...identity, ...data },
        update: data,
      });
    }));
    processed += batch.length;
  }

  console.log(JSON.stringify({
    contestId: payload.contestId,
    positionId: payload.positionId,
    processed,
    total: payload.rows.length,
    importedAt: importedAt.toISOString(),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
