import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('keeps a single attempt when the same session answer is submitted concurrently', async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `a9-answer-race-${suffix}@example.com`;

  const board = await prisma.examBoard.create({
    data: { name: `Banca Race ${suffix}`, acronym: `RACE${suffix}` },
  });
  const exam = await prisma.exam.create({
    data: { boardId: board.id, title: `Prova Race ${suffix}`, year: 2026 },
  });
  const question = await prisma.question.create({
    data: {
      examId: exam.id,
      boardId: board.id,
      number: 1,
      statement: `Questão concorrente ${suffix}`,
      contentFingerprint: `answer-race-${suffix}`,
      choices: {
        create: [
          { label: 'A', text: 'Correta', isCorrect: true },
          { label: 'B', text: 'Incorreta', isCorrect: false },
        ],
      },
    },
  });

  try {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
    await page.getByPlaceholder('Nome').fill('A9 Concorrência');
    await page.getByPlaceholder('E-mail').fill(email);
    await page.getByPlaceholder('Senha').fill('Playwright123!');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const result = await page.evaluate(async ({ boardId, questionId }) => {
      const simulationResponse = await fetch('/api/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, quantity: 1 }),
      });
      if (!simulationResponse.ok) throw new Error(`simulation:${simulationResponse.status}`);
      const simulation = await simulationResponse.json();
      const sessionId = simulation.session.id as string;

      const responses = await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          fetch(`/api/simulations/${sessionId}/answers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionId,
              selected: index % 2 === 0 ? 'A' : 'B',
              elapsedMs: 100 + index,
            }),
          }),
        ),
      );

      return {
        sessionId,
        statuses: responses.map((response) => response.status),
      };
    }, { boardId: board.id, questionId: question.id });

    expect(result.statuses).toEqual(Array(10).fill(200));
    await expect.poll(() => prisma.questionAttempt.count({
      where: { sessionId: result.sessionId, questionId: question.id },
    })).toBe(1);
  } finally {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
    await prisma.examBoard.delete({ where: { id: board.id } });
  }
});
