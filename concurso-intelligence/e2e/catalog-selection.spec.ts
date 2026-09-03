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
  const otherPosition = await prisma.contestPosition.create({
    data: {
      contestId: contest.id,
      name: `Analista Administrativo ${suffix}`,
      area: 'Administrativa',
      vacancies: 3,
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
      positions: expect.arrayContaining([
        {
          id: position.id,
          name: position.name,
          area: position.area,
          vacancies: position.vacancies,
        },
        {
          id: otherPosition.id,
          name: otherPosition.name,
          area: otherPosition.area,
          vacancies: otherPosition.vacancies,
        },
      ]),
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

    const selectByField = (label: string) => page
      .locator('label')
      .filter({ has: page.getByText(label, { exact: true }) })
      .locator('select');
    const boardSelect = selectByField('Banca');
    const contestSelect = selectByField('Concurso');
    const areaSelect = selectByField('Área');
    const positionSelect = selectByField('Cargo');
    const subjectSelect = selectByField('Disciplina');
    const topicSelect = selectByField('Assunto');
    const subtopicSelect = selectByField('Subassunto');

    await boardSelect.selectOption({ label: `${board.acronym} · ${board.name}` });
    await expect(boardSelect).not.toHaveValue('');

    await expect(areaSelect).toBeDisabled();
    await expect(positionSelect).toBeDisabled();
    await contestSelect.selectOption({ label: `${contest.name} · 2026` });
    await expect(areaSelect).toBeEnabled();
    await expect(positionSelect).toBeEnabled();

    await areaSelect.selectOption({ label: 'Tecnologia' });
    await expect(positionSelect.locator('option', { hasText: `${position.name} · Tecnologia` })).toHaveCount(1);
    await expect(positionSelect.locator('option', { hasText: `${otherPosition.name} · Administrativa` })).toHaveCount(0);
    await positionSelect.selectOption({ label: `${position.name} · Tecnologia` });
    await expect(positionSelect).not.toHaveValue('');

    await areaSelect.selectOption({ label: 'Administrativa' });
    await expect(positionSelect).toHaveValue('');
    await expect(positionSelect.locator('option', { hasText: `${position.name} · Tecnologia` })).toHaveCount(0);
    await expect(positionSelect.locator('option', { hasText: `${otherPosition.name} · Administrativa` })).toHaveCount(1);

    await expect(topicSelect).toBeDisabled();
    await expect(subtopicSelect).toBeDisabled();
    await subjectSelect.selectOption({ label: subject.name });
    await expect(topicSelect).toBeEnabled();
    await topicSelect.selectOption({ label: rootTopic.name });
    await expect(topicSelect).not.toHaveValue('');
    await expect(subtopicSelect).toBeEnabled();
    await subtopicSelect.selectOption({ label: childTopic.name });
    await expect(subtopicSelect).not.toHaveValue('');

    await subjectSelect.selectOption({ label: 'Todos' });
    await expect(topicSelect).toHaveValue('');
    await expect(subtopicSelect).toHaveValue('');
    await expect(topicSelect).toBeDisabled();
    await expect(subtopicSelect).toBeDisabled();
  } finally {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.subject.delete({ where: { id: subject.id } });
    await prisma.contest.delete({ where: { id: contest.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.examBoard.delete({ where: { id: board.id } });
  }
});
