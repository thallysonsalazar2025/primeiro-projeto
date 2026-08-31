import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('imports and reimports official ranking rows without duplicates', async () => {
  const suffix = Date.now().toString();
  const organization = await prisma.organization.create({ data: { name: `Órgão Import ${suffix}` } });
  const contest = await prisma.contest.create({
    data: { name: `Concurso Import ${suffix}`, year: 2026, organizationId: organization.id, status: 'RESULTS_PUBLISHED' },
  });
  const position = await prisma.contestPosition.create({
    data: { contestId: contest.id, name: `Cargo Import ${suffix}`, vacancies: 2 },
  });
  const tempDir = await mkdtemp(join(tmpdir(), 'ranking-import-'));
  const inputPath = join(tempDir, 'ranking.json');

  const runImporter = () => execFileSync(
    process.execPath,
    ['--experimental-strip-types', 'scripts/import-official-ranking-json.ts', inputPath],
    { cwd: process.cwd(), env: process.env, encoding: 'utf8' },
  );

  try {
    await writeFile(inputPath, JSON.stringify({
      contestId: contest.id,
      positionId: position.id,
      sourceUrl: `https://example.gov.br/resultados/${suffix}.pdf`,
      sourcePage: 10,
      rows: [
        { candidateKey: 'candidate-1', score: 90, rank: 1 },
        { candidateKey: 'candidate-2', score: 80, rank: 2, sourcePage: 11 },
      ],
    }));

    const firstOutput = JSON.parse(runImporter());
    expect(firstOutput).toMatchObject({ contestId: contest.id, positionId: position.id, processed: 2, total: 2 });

    const firstRows = await prisma.officialRankingRow.findMany({
      where: { contestId: contest.id, positionId: position.id },
      orderBy: { candidateKey: 'asc' },
    });
    expect(firstRows).toHaveLength(2);
    expect(Number(firstRows[0].score)).toBe(90);
    expect(firstRows[0].sourcePage).toBe(10);
    expect(firstRows[1].sourcePage).toBe(11);
    const firstImportedAt = firstRows[0].importedAt;

    await new Promise((resolve) => setTimeout(resolve, 10));
    await writeFile(inputPath, JSON.stringify({
      contestId: contest.id,
      positionId: position.id,
      sourceUrl: `https://example.gov.br/resultados/${suffix}-retificado.pdf`,
      sourcePage: 20,
      rows: [
        { candidateKey: 'candidate-1', score: 91, rank: 1 },
        { candidateKey: 'candidate-2', score: 79, rank: 2 },
      ],
    }));

    runImporter();

    const secondRows = await prisma.officialRankingRow.findMany({
      where: { contestId: contest.id, positionId: position.id },
      orderBy: { candidateKey: 'asc' },
    });
    expect(secondRows).toHaveLength(2);
    expect(Number(secondRows[0].score)).toBe(91);
    expect(secondRows[0].sourceUrl).toContain('-retificado.pdf');
    expect(secondRows[0].sourcePage).toBe(20);
    expect(secondRows[0].importedAt.getTime()).toBeGreaterThan(firstImportedAt.getTime());
  } finally {
    await prisma.officialRankingRow.deleteMany({ where: { contestId: contest.id } });
    await prisma.contestPosition.delete({ where: { id: position.id } });
    await prisma.contest.delete({ where: { id: contest.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await rm(tempDir, { recursive: true, force: true });
  }
});
