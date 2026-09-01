import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('returns and renders authenticated performance grouped by board, contest, subject and topic', async ({ page }) => {
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
  const subject = await prisma.subject.create({
    data: { name: `Disciplina Performance ${suffix}` },
  });
  const parentTopic = await prisma.topic.create({
    data: { subjectId: subject.id, name: `Pai Performance ${suffix}` },
  });
  const topic = await prisma.topic.create({
    data: { subjectId: subject.id, parentId: parentTopic.id, name: `Assunto Performance ${suffix}` },
  });
  const question = await prisma.question.create({
    data: {
      examId: exam.id,
      boardId: board.id,
      subjectId: subject.id,
      topicId: topic.id,
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
    expect(payload.subjects).toContainEqual({
      subjectId: subject.id,
      subjectName: subject.name,
      attempts: 2,
      correct: 1,
      accuracy: 50,
    });
    expect(payload.topics).toContainEqual({
      topicId: topic.id,
      topicName: topic.name,
      parentName: parentTopic.name,
      subjectName: subject.name,
      attempts: 2,
      correct: 1,
      accuracy: 50,
    });

    await page.reload();
    const boardPanel = page.getByRole('region', { name: 'Desempenho por banca' });
    await expect(boardPanel).toContainText(`PERF${suffix} · Banca Performance ${suffix}`);
    await expect(boardPanel).toContainText('50%');
    await expect(boardPanel).toContainText('1/2 acertos');

    const contestPanel = page.getByRole('region', { name: 'Desempenho por concurso' });
    await expect(contestPanel).toContainText(`Concurso Performance ${suffix} · 2026`);
    await expect(contestPanel).toContainText('50%');
    await expect(contestPanel).toContainText('1/2 acertos');

    const subjectPanel = page.getByRole('region', { name: 'Desempenho por disciplina' });
    await expect(subjectPanel).toContainText(`Disciplina Performance ${suffix}`);
    await expect(subjectPanel).toContainText('50%');
    await expect(subjectPanel).toContainText('1/2 acertos');

    const topicPanel = page.getByRole('region', { name: 'Desempenho por assunto' });
    await expect(topicPanel).toContainText(`Pai Performance ${suffix} › Assunto Performance ${suffix}`);
    await expect(topicPanel).toContainText(`Disciplina Performance ${suffix}`);
    await expect(topicPanel).toContainText('50%');
    await expect(topicPanel).toContainText('1/2 acertos');
  } finally {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.question.delete({ where: { id: question.id } });
    await prisma.topic.delete({ where: { id: topic.id } });
    await prisma.topic.delete({ where: { id: parentTopic.id } });
    await prisma.subject.delete({ where: { id: subject.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
    await prisma.contest.delete({ where: { id: contest.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.examBoard.delete({ where: { id: board.id } });
  }
});
