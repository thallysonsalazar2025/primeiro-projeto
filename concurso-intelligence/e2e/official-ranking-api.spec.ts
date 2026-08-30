import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('returns authenticated estimate from an official ranking distribution', async ({ page }) => {
  const suffix = Date.now().toString();
  const email = `a8-ranking-${suffix}@example.com`;
  const organization = await prisma.organization.create({ data: { name: `Órgão Ranking ${suffix}` } });
  const contest = await prisma.contest.create({
    data: { name: `Concurso Ranking ${suffix}`, year: 2026, organizationId: organization.id, status: 'RESULTS_PUBLISHED' },
  });
  const position = await prisma.contestPosition.create({
    data: { contestId: contest.id, name: `Cargo Ranking ${suffix}`, vacancies: 2 },
  });
  const sourceUrl = `https://example.gov.br/resultados/${suffix}.pdf`;

  await prisma.officialRankingRow.createMany({
    data: [90, 80, 70, 60].map((score, index) => ({
      contestId: contest.id,
      positionId: position.id,
      candidateKey: `candidate-${suffix}-${index}`,
      score,
      rank: index + 1,
      category: 'GENERAL',
      sourceUrl,
    })),
  });

  try {
    const query = `contestId=${contest.id}&positionId=${position.id}&category=GENERAL&score=75`;
    const unauthorized = await page.request.get(`/api/ranking/official?${query}`);
    expect(unauthorized.status()).toBe(401);

    await page.goto('/login');
    await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
    await page.getByPlaceholder('Nome').fill('A8 Ranking');
    await page.getByPlaceholder('E-mail').fill(email);
    await page.getByPlaceholder('Senha').fill('Playwright123!');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const response = await page.request.get(`/api/ranking/official?${query}`);
    expect(response.status()).toBe(200);
    const payload = await response.json();

    expect(payload.estimate).toMatchObject({
      estimatedRank: 3,
      method: 'official-distribution',
      sampleSize: 4,
      confidence: 'low',
    });
    expect(payload.provenance.sources).toEqual([sourceUrl]);
    expect(payload.disclaimer).toMatch(/não substitui a classificação publicada/i);
    expect(JSON.stringify(payload)).not.toContain('candidate-');
  } finally {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.officialRankingRow.deleteMany({ where: { contestId: contest.id } });
    await prisma.contestPosition.delete({ where: { id: position.id } });
    await prisma.contest.delete({ where: { id: contest.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
  }
});
