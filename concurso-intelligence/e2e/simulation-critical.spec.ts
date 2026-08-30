import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('creates, resumes, reviews and finishes a simulation', async ({ page }) => {
  const suffix = Date.now().toString();
  const email = `a9-sim-${suffix}@example.com`;

  const board = await prisma.examBoard.create({
    data: { name: `Banca E2E ${suffix}`, acronym: `E2E${suffix}` },
  });
  const subject = await prisma.subject.create({
    data: { name: `Disciplina E2E ${suffix}` },
  });
  const topic = await prisma.topic.create({
    data: { subjectId: subject.id, name: `Assunto E2E ${suffix}` },
  });
  const exam = await prisma.exam.create({
    data: {
      boardId: board.id,
      title: `Prova E2E ${suffix}`,
      year: 2026,
    },
  });

  await prisma.question.create({
    data: {
      examId: exam.id,
      boardId: board.id,
      subjectId: subject.id,
      topicId: topic.id,
      number: 1,
      statement: `Questão crítica E2E ${suffix}`,
      contentFingerprint: `e2e-critical-${suffix}`,
      choices: {
        create: [
          { label: 'A', text: 'Resposta correta', isCorrect: true },
          { label: 'B', text: 'Resposta incorreta', isCorrect: false },
        ],
      },
    },
  });

  try {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
    await page.getByPlaceholder('Nome').fill('A9 QA');
    await page.getByPlaceholder('E-mail').fill(email);
    await page.getByPlaceholder('Senha').fill('Playwright123!');
    await page.getByRole('button', { name: 'Criar conta' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole('combobox', { name: /^Banca/ }).selectOption(board.id);
    await page.getByLabel('Quantidade').fill('1');
    await page.getByRole('button', { name: 'Começar simulado' }).click();

    await expect(page).toHaveURL(/\/simulations\/[^/]+$/);
    await expect(page.getByText(`Questão crítica E2E ${suffix}`)).toBeVisible();

    const correctAnswer = page.getByRole('radio', { name: /A\. Resposta correta/ });
    await correctAnswer.click();
    await expect(page.getByText('1/1 respondidas')).toBeVisible();
    await expect(correctAnswer).toBeChecked();

    await page.getByRole('button', { name: '☆ Marcar para revisão' }).click();
    await expect(page.getByRole('button', { name: '★ Marcada para revisão' })).toBeVisible();

    await page.reload();
    await expect(page.getByText('1/1 respondidas')).toBeVisible();
    await expect(page.getByRole('button', { name: '★ Marcada para revisão' })).toBeVisible();
    await expect(page.getByRole('radio', { name: /A\. Resposta correta/ })).toBeChecked();

    await page.getByRole('button', { name: /^Finalizar prova/ }).click();
    await expect(page.getByRole('heading', { name: 'Resultado' })).toBeVisible();
    await expect(page.getByText('100% de acerto')).toBeVisible();
    await expect(page.getByText('✓ Correta')).toBeVisible();
    await expect(page.getByText('Gabarito: A')).toBeVisible();
  } finally {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
    await prisma.topic.delete({ where: { id: topic.id } });
    await prisma.subject.delete({ where: { id: subject.id } });
    await prisma.examBoard.delete({ where: { id: board.id } });
  }
});
