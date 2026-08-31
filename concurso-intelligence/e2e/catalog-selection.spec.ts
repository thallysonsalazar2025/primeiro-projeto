import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('returns catalog relationships and renders dependent preparation filters', async ({ page }) => {
  test.setTimeout(60_000);

  const suffix = Date.now().toString();
  const email = `a3-catalog-${suffix}@example.com`;
  const board = await prisma.examBoard.create({
    data: { name: `Banca Catálogo ${suffix}`, acronym: `CAT${suffix}` },
  });
  const organization = await prisma.organization.create({
    data: { name: `Órgão Catálogo ${suffix}`, acronym: `ORG${suffix}` },
  });
  const contest = await prisma.contest.create({
    data: {
      name: `Concurso Catálogo ${suffix}`,
      year: 2026,
      organizationId: organization.id,
    },
  });
  const position = await prisma.contestPosition.create({
    data: {
      contestId: contest.id,
      name: `Analista Catálogo ${suffix}`,
      area: 'Tecnologia',
      vacancies: 5,
    },
  });
  const subject = await prisma.subject.create({
    data: { name: `Disciplina Catálogo ${suffix}` },
  });
  const rootTopic = await prisma.topic.create({
    data: { subjectId: subject.id, name: `Assunto Raiz ${suffix}` },
  });
  const childTopic = await prisma.topic.create({
    data: {
      subjectId: subject.id,
      parentId: rootTopic.id,
      name: `Subassunto ${suffix}`,
    },
  });

  try {
    const response = await page.request.get('/api/catalog');
    expect(response.status()).toBe(200);
    const payload = await response.json();

    expect(payload.boards).toContainEqual({
      id: board.id,
      name: board.name,
      acronym: board.acronym,
    });
    expect(payload.contests).toContainEqual(expect.objectContaining({
      id: contest.id,
      name: contest.name,
      year: 2026,
      organization: {
        id: organization.id,
        name: organization.name,
        acronym: organization.acronym,
      },
      positions: [
        {
          id: position.id,
          name: position.name,
          area: position.area,
          vacancies: position.vacancies,
        },
      ],
    }));
    expect(payload.subjects).toContainEqual(expect.objectContaining({
      id: subject.id,
      name: subject.name,
      topics: [
        {
          id: rootTopic.id,
          name: rootTopic.name,
          children: [{ id: childTopic.id, name: childTopic.name }],
        },
      ],
    }));

    await page.goto('/login');
    await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
    await page.getByPlaceholder('Nome').fill('A3 Catálogo E2E');
    await page.getByPlaceholder('E-mail').fill(email);
    await page.getByPlaceholder('Senha').fill('Playwright123!');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const boardSelect = page.getByLabel('Banca', { exact: true });
    const contestSelect = page.getByLabel('Concurso', { exact: true });
    const positionSelect = page.getByLabel('Cargo', { exact: true });
    const subjectSelect = page.getByLabel('Disciplina', { exact: true });
    const topicSelect = page.getByLabel('Assunto', { exact: true });

    await expect(boardSelect.locator(`option[value="${board.id}"]`)).toHaveText(`${board.acronym} · ${board.name}`);
    await expect(contestSelect.locator(`option[value="${contest.id}"]`)).toHaveText(`${contest.name} · 2026`);
    await expect(positionSelect).toBeDisabled();
    await contestSelect.selectOption(contest.id);
    await expect(positionSelect).toBeEnabled();
    await expect(positionSelect.locator(`option[value="${position.id}"]`)).toHaveText(`${position.name} · Tecnologia`);

    await expect(topicSelect).toBeDisabled();
    await subjectSelect.selectOption(subject.id);
    await expect(topicSelect).toBeEnabled();
    await expect(topicSelect.locator(`option[value="${rootTopic.id}"]`)).toHaveText(rootTopic.name);
    await expect(topicSelect.locator(`option[value="${childTopic.id}"]`)).toHaveText(`${rootTopic.name} › ${childTopic.name}`);
  } finally {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.subject.delete({ where: { id: subject.id } });
    await prisma.contest.delete({ where: { id: contest.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.examBoard.delete({ where: { id: board.id } });
  }
});
