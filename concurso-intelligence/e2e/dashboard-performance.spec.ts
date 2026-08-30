import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('shows persisted simulation performance on the dashboard', async ({ page }) => {
  test.setTimeout(60_000);

  const suffix = Date.now().toString();
  const email = `a9-dashboard-${suffix}@example.com`;

  const board = await prisma.examBoard.create({
    data: { name: `Banca Dashboard ${suffix}`, acronym: `DASH${suffix}` },
  });
  const subject = await prisma.subject.create({
    data: { name: `Disciplina Dashboard ${suffix}` },
  });
  const topic = await prisma.topic.create({
    data: { subjectId: subject.id, name: `Assunto Dashboard ${suffix}` },
  });
  const exam = await prisma.exam.create({
    data: {
      boardId: board.id,
      title: `Prova Dashboard ${suffix}`,
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
      statement: `Questão dashboard E2E ${suffix}`,
      contentFingerprint: `e2e-dashboard-${suffix}`,
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
    await page.getByPlaceholder('Nome').fill('A9 QA Dashboard');
    await page.getByPlaceholder('E-mail').fill(email);
    await page.getByPlaceholder('Senha').fill('Playwright123!');
    await page.getByRole('button', { name: 'Criar conta' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByLabel('Banca').selectOption(board.id);
    await page.getByLabel('Quantidade').fill('1');
    await page.getByRole('button', { name: 'Começar simulado' }).click();

    await expect(page.getByText(`Questão dashboard E2E ${suffix}`)).toBeVisible();
    const correctAnswer = page.getByRole('radio', { name: /A\. Resposta correta/ });
    await correctAnswer.click();
    await expect(page.getByText('1/1 respondidas')).toBeVisible();
    await expect(correctAnswer).toBeChecked();

    await page.getByRole('button', { name: /^Finalizar prova/ }).click();
    await expect(page.getByRole('heading', { name: 'Resultado' })).toBeVisible();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);

    await expect(page.getByText('Questões respondidas', { exact: true }).locator('..')).toContainText('1');
    await expect(page.getByText('Taxa de acerto', { exact: true }).locator('..')).toContainText('100%');
    await expect(page.getByText('Acertos', { exact: true }).locator('..')).toContainText('1');

    const trendSection = page.getByRole('heading', { name: 'Evolução nos últimos 7 dias' }).locator('..');
    await expect(trendSection).toContainText('1/1 acertos');
    await expect(trendSection).toContainText('1 questão respondida');
    await expect(trendSection).toContainText('100%');

    const subjectSection = page.getByRole('heading', { name: 'Desempenho por disciplina' }).locator('..');
    await expect(subjectSection).toContainText(subject.name);
    await expect(subjectSection).toContainText('1/1 acertos');
    await expect(subjectSection).toContainText('100%');

    const topicSection = page.getByRole('heading', { name: 'Desempenho por assunto' }).locator('..');
    await expect(topicSection).toContainText(topic.name);
    await expect(topicSection).toContainText(subject.name);
    await expect(topicSection).toContainText('1/1 acertos');
    await expect(topicSection).toContainText('100%');

    const recentSessions = page.getByRole('heading', { name: 'Sessões recentes' }).locator('..');
    await expect(recentSessions).toContainText('Finalizado');
    await expect(recentSessions).toContainText('Ver resultado');
  } finally {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
    await prisma.topic.delete({ where: { id: topic.id } });
    await prisma.subject.delete({ where: { id: subject.id } });
    await prisma.examBoard.delete({ where: { id: board.id } });
  }
});
