import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('returns authenticated performance grouped by board and contest', async ({ page }) => {
  test.setTimeout(60_000);

  const suffix = Date.now().toString();
  const email = `a6-performance-${suffix}@example.com`;
  const board = await prisma.examBoard.create({
    data: { name: `Banca Performance ${suffix}`, acronym: `PERF${suffix}` },
  });
  const organization = await prisma.organization.create({
    data: { name: `Órgão Performance ${suffix}`, acronym: `ORG${suffix}` },
  });
  const contest = await prisma.contest.create({
    data: {
      name: `Concurso Performance ${suffix}`,
      year: 2026,
      organizationId: organization.id,
    },
  });
  const exam = await prisma.exam.create({
    data: {
      boardId: board.id,
      organizationId: organization.id,
      contestId: contest.id,
      title: `Prova Performance ${suffix}`,
      year: 2026,
    },
  });
  const question = await prisma.question.create({
    data: {
      examId: exam.id,
      boardId: board.id,
      statement: `Questão performance ${suffix}`,
      contentFingerprint: `performance-${suffix}`,
      choices: {
        create: [
          { label: 'A', text: 'Correta', isCorrect: true },
          { label: 'B', text: 'Incorreta', isCorrect: false },
        ],
      },
    },
  });

  try {
    const unauthorized = await page.request.get('/api/dashboard/performance');
    expect(unauthorized.status()).toBe(401);

    await page.goto('/login');
    await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
    await page.getByPlaceholder('Nome').fill('A6 Dashboard Performance');
    await page.getByPlaceholder('E-mail').fill(email);
    await page.getByPlaceholder('Senha').fill('Playwright123!');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.questionAttempt.createMany({
      data: [
        { userId: user.id, questionId: question.id, selected: 'A', correct: true },
        { userId: user.id, questionId: question.id, selected: 'B', correct: false },
      ],
    });

    const response = await page.request.get('/api/dashboard/performance');
    expect(response.status()).toBe(200);

    const payload = await response.json();
    expect(payload.boards).toContainEqual({
      boardId: board.id,
      boardName: board.name,
      acronym: board.acronym,
      attempts: 2,
      correct: 1,
      accuracy: 50,
    });
    expect(payload.contests).toContainEqual({
      contestId: contest.id,
      contestName: contest.name,
      year: 2026,
      attempts: 2,
      correct: 1,
      accuracy: 50,
    });
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
