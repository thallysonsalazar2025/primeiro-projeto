import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('returns only recurrent wrong answers for the authenticated user', async ({ page }) => {
  test.setTimeout(60_000);
  const suffix = Date.now().toString();
  const email = `a6-recurrent-${suffix}@example.com`;

  const board = await prisma.examBoard.create({
    data: { name: `Banca Reincidencia ${suffix}`, acronym: `REC${suffix}` },
  });
  const organization = await prisma.organization.create({
    data: { name: `Orgao Reincidencia ${suffix}`, acronym: `OR${suffix}` },
  });
  const contest = await prisma.contest.create({
    data: { name: `Concurso Reincidencia ${suffix}`, year: 2026, organizationId: organization.id },
  });
  const exam = await prisma.exam.create({
    data: {
      boardId: board.id,
      organizationId: organization.id,
      contestId: contest.id,
      title: `Prova Reincidencia ${suffix}`,
      year: 2026,
    },
  });
  const subject = await prisma.subject.create({ data: { name: `Disciplina Reincidencia ${suffix}` } });
  const topic = await prisma.topic.create({
    data: { subjectId: subject.id, name: `Assunto Reincidencia ${suffix}` },
  });
  const recurrentQuestion = await prisma.question.create({
    data: {
      examId: exam.id,
      boardId: board.id,
      subjectId: subject.id,
      topicId: topic.id,
      statement: `Questao reincidente ${suffix}`,
      contentFingerprint: `recurrent-${suffix}`,
    },
  });
  const isolatedQuestion = await prisma.question.create({
    data: {
      examId: exam.id,
      boardId: board.id,
      subjectId: subject.id,
      topicId: topic.id,
      statement: `Questao erro unico ${suffix}`,
      contentFingerprint: `single-error-${suffix}`,
    },
  });
  const otherUser = await prisma.user.create({
    data: {
      email: `a6-recurrent-other-${suffix}@example.com`,
      passwordHash: 'not-used-by-test',
      name: 'Outro usuario',
    },
  });

  try {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
    await page.getByPlaceholder('Nome').fill('A6 Reincidencia');
    await page.getByPlaceholder('E-mail').fill(email);
    await page.getByPlaceholder('Senha').fill('Playwright123!');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.questionAttempt.createMany({
      data: [
        { userId: user.id, questionId: recurrentQuestion.id, selected: 'B', correct: false },
        { userId: user.id, questionId: recurrentQuestion.id, selected: 'B', correct: false },
        { userId: user.id, questionId: isolatedQuestion.id, selected: 'B', correct: false },
        { userId: otherUser.id, questionId: recurrentQuestion.id, selected: 'B', correct: false },
        { userId: otherUser.id, questionId: recurrentQuestion.id, selected: 'B', correct: false },
        { userId: otherUser.id, questionId: recurrentQuestion.id, selected: 'B', correct: false },
      ],
    });

    const response = await page.request.get('/api/dashboard/performance');
    expect(response.status()).toBe(200);
    const payload = await response.json();

    expect(payload.recurrentErrors).toHaveLength(1);
    expect(payload.recurrentErrors[0]).toMatchObject({
      questionId: recurrentQuestion.id,
      statement: recurrentQuestion.statement,
      subjectName: subject.name,
      topicName: topic.name,
      wrongAttempts: 2,
    });
    expect(payload.recurrentErrors[0].lastWrongAt).toEqual(expect.any(String));
  } finally {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
    await prisma.question.deleteMany({ where: { id: { in: [recurrentQuestion.id, isolatedQuestion.id] } } });
    await prisma.topic.delete({ where: { id: topic.id } });
    await prisma.subject.delete({ where: { id: subject.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
    await prisma.contest.delete({ where: { id: contest.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.examBoard.delete({ where: { id: board.id } });
  }
});
