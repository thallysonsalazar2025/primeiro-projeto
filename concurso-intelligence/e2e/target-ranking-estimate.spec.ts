import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('estimates saved preparation targets against official ranking rows', async ({ page }) => {
  const suffix = Date.now().toString();
  const email = `a8-target-estimate-${suffix}@example.com`;
  const organization = await prisma.organization.create({ data: { name: `Órgão Target ${suffix}` } });
  const contest = await prisma.contest.create({
    data: { name: `Concurso Target ${suffix}`, year: 2026, organizationId: organization.id, status: 'RESULTS_PUBLISHED' },
  });
  const position = await prisma.contestPosition.create({
    data: { contestId: contest.id, name: `Cargo Target ${suffix}`, vacancies: 3 },
  });

  await prisma.officialRankingRow.createMany({
    data: [
      ...[95, 85, 75, 65].map((score, index) => ({
        contestId: contest.id,
        positionId: position.id,
        candidateKey: `target-candidate-general-${suffix}-${index}`,
        score,
        rank: index + 1,
        category: 'GENERAL' as const,
        sourceUrl: `https://example.gov.br/target/${suffix}.pdf`,
      })),
      ...[92, 82, 72].map((score, index) => ({
        contestId: contest.id,
        positionId: position.id,
        candidateKey: `target-candidate-pcd-${suffix}-${index}`,
        score,
        rank: index + 1,
        category: 'PCD' as const,
        sourceUrl: `https://example.gov.br/target/${suffix}.pdf`,
      })),
    ],
  });

  try {
    const unauthorized = await page.request.get('/api/ranking/estimate');
    expect(unauthorized.status()).toBe(401);

    await page.goto('/login');
    await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
    await page.getByPlaceholder('Nome').fill('A8 Target Estimate');
    await page.getByPlaceholder('E-mail').fill(email);
    await page.getByPlaceholder('Senha').fill('Playwright123!');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const targetResponse = await page.request.post('/api/preparation-targets', {
      data: { contestId: contest.id, positionId: position.id, targetScore: 80 },
    });
    expect(targetResponse.status()).toBe(201);

    const response = await page.request.get('/api/ranking/estimate');
    expect(response.status()).toBe(200);
    const payload = await response.json();

    expect(payload.estimates).toHaveLength(1);
    expect(payload.estimates[0]).toMatchObject({
      contest: { id: contest.id, name: contest.name, year: 2026 },
      position: { id: position.id, name: position.name, vacancies: 3 },
      category: 'GENERAL',
      targetScore: 80,
      estimate: {
        lowerRank: 2,
        upperRank: 4,
        estimatedRank: 3,
        percentile: 0.5,
        sampleSize: 4,
        confidence: 'low',
        method: 'official-distribution',
      },
    });
    expect(payload.estimates[0].disclaimer).toMatch(/não substitui a classificação/i);
    expect(JSON.stringify(payload)).not.toContain('target-candidate-');

    const pcdResponse = await page.request.get('/api/ranking/estimate?category=PCD');
    expect(pcdResponse.status()).toBe(200);
    const pcdPayload = await pcdResponse.json();
    expect(pcdPayload.estimates).toHaveLength(1);
    expect(pcdPayload.estimates[0]).toMatchObject({
      category: 'PCD',
      targetScore: 80,
      estimate: {
        estimatedRank: 3,
        percentile: 1 / 3,
        sampleSize: 3,
        confidence: 'low',
        method: 'official-distribution',
      },
    });
  } finally {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.officialRankingRow.deleteMany({ where: { contestId: contest.id } });
    await prisma.contestPosition.delete({ where: { id: position.id } });
    await prisma.contest.delete({ where: { id: contest.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
  }
});
