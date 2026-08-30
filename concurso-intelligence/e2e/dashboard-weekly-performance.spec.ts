import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('returns authenticated weekly performance for recent answered questions', async ({ page }) => {
  test.setTimeout(60_000);

  const suffix = Date.now().toString();
  const email = `a6-weekly-${suffix}@example.com`;
  const board = await prisma.examBoard.create({
    data: { name: `Banca Weekly ${suffix}`, acronym: `WK${suffix}` },
  });
  const organization = await prisma.organization.create({
    data: { name: `Órgão Weekly ${suffix}`, acronym: `ORGWK${suffix}` },
  });
  const contest = await prisma.contest.create({
    data: {
      name: `Concurso Weekly ${suffix}`,
      year: 2026,
      organizationId: organization.id,
    },
  });
  const exam = await prisma.exam.create({
    data: {
      boardId: board.id,
      organizationId: organization.id,
      contestId: contest.id,
      title: `Prova Weekly ${suffix}`,
      year: 2026,
    },
  });
  const question = await prisma.question.create({
    data: {
      examId: exam.id,
      boardId: board.id,
      statement: `Questão semanal ${suffix}`,
      contentFingerprint: `weekly-${suffix}`,
      choices: {
        create: [
          { label: 'A', text: 'Correta', isCorrect: true },
          { label: 'B', text: 'Incorreta', isCorrect: false },
        ],
      },
    },
  });

  try {
    const unauthorized = await page.request.get('/api/dashboard/weekly');
    expect(unauthorized.status()).toBe(401);

    await page.goto('/login');
    await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
    await page.getByPlaceholder('Nome').fill('A6 Dashboard Weekly');
    await page.getByPlaceholder('E-mail').fill(email);
    await page.getByPlaceholder('Senha').fill('Playwright123!');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const now = new Date();
    const olderWeek = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

    await prisma.questionAttempt.createMany({
      data: [
        { userId: user.id, questionId: question.id, selected: 'A', correct: true, answeredAt: olderWeek },
        { userId: user.id, questionId: question.id, selected: 'A', correct: true, answeredAt: now },
        { userId: user.id, questionId: question.id, selected: 'B', correct: false, answeredAt: now },
      ],
    });

    const response = await page.request.get('/api/dashboard/weekly');
    expect(response.status()).toBe(200);

    const payload = await response.json();
    expect(payload.weeks).toHaveLength(2);
    expect(payload.weeks[0]).toMatchObject({ attempts: 1, correct: 1, accuracy: 100 });
    expect(payload.weeks[1]).toMatchObject({ attempts: 2, correct: 1, accuracy: 50 });
    expect(payload.weeks[0].weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.weeks[1].weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(payload.weeks[0].weekStart < payload.weeks[1].weekStart).toBe(true);
  } finally {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.question.delete({ where: { id: question.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
    await prisma.contest.delete({ where: { id: contest.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.examBoard.delete({ where: { id: board.id } });
  }
});
