import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('exposes authenticated future-ranking projection with explicit assumptions', async ({ page }) => {
  const unauthorized = await page.request.post('/api/ranking/future-estimate', {
    data: {
      simulatedScorePercent: 80,
      expectedCandidates: 500,
      targetBoard: 'FGV',
      targetCategory: 'GENERAL',
      history: [],
    },
  });
  expect(unauthorized.status()).toBe(401);

  const email = `a8-future-estimate-${Date.now()}@example.com`;
  await page.goto('/login');
  await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
  await page.getByPlaceholder('Nome').fill('A8 Future Estimate');
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill('Playwright123!');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  try {
    const history = [
      {
        contestId: 'fgv-ti-2025',
        board: 'FGV',
        cargoFamily: 'TI',
        subjectSimilarity: 1,
        difficultySimilarity: 0.9,
        vacancySimilarity: 0.8,
        rows: Array.from({ length: 20 }, (_, index) => ({
          score: index + 70,
          category: 'GENERAL',
        })),
      },
    ];

    const response = await page.request.post('/api/ranking/future-estimate', {
      data: {
        simulatedScorePercent: 80,
        expectedCandidates: 500,
        targetBoard: 'FGV',
        targetCargoFamily: 'TI',
        targetCategory: 'GENERAL',
        history,
      },
    });

    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.estimate).toMatchObject({
      method: 'historical-board-model',
      sampleSize: 20,
      confidence: 'low',
    });
    expect(payload.estimate.lowerRank).toBeGreaterThanOrEqual(1);
    expect(payload.estimate.upperRank).toBeLessThanOrEqual(500);
    expect(payload.assumptions).toEqual({
      expectedCandidates: 500,
      targetBoard: 'FGV',
      targetCargoFamily: 'TI',
      targetCategory: 'GENERAL',
      historicalContests: 1,
    });
    expect(payload.disclaimer).toMatch(/não representa classificação oficial/i);

    const invalid = await page.request.post('/api/ranking/future-estimate', {
      data: {
        simulatedScorePercent: 101,
        expectedCandidates: 500,
        targetBoard: 'FGV',
        targetCategory: 'GENERAL',
        history,
      },
    });
    expect(invalid.status()).toBe(400);

    const duplicateHistory = await page.request.post('/api/ranking/future-estimate', {
      data: {
        simulatedScorePercent: 80,
        expectedCandidates: 500,
        targetBoard: 'FGV',
        targetCategory: 'GENERAL',
        history: [history[0], { ...history[0] }],
      },
    });
    expect(duplicateHistory.status()).toBe(400);

    const mixedCategory = await page.request.post('/api/ranking/future-estimate', {
      data: {
        simulatedScorePercent: 80,
        expectedCandidates: 500,
        targetBoard: 'FGV',
        targetCategory: 'GENERAL',
        history: [
          {
            ...history[0],
            contestId: 'fgv-ti-2024',
            rows: history[0].rows.map((row, index) =>
              index === 0 ? { ...row, category: 'PCD' } : row,
            ),
          },
        ],
      },
    });
    expect(mixedCategory.status()).toBe(400);
  } finally {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
  }
});
