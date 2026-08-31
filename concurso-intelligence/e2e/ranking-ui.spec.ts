import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('protects ranking page and renders an official estimate for an authenticated user', async ({ page }) => {
  await page.goto('/ranking');
  await expect(page).toHaveURL(/\/login$/);

  const suffix = Date.now().toString();
  const email = `a8-ranking-ui-${suffix}@example.com`;
  const organization = await prisma.organization.create({ data: { name: `Órgão UI ${suffix}` } });
  const contest = await prisma.contest.create({
    data: { name: `Concurso UI ${suffix}`, year: 2026, organizationId: organization.id, status: 'RESULTS_PUBLISHED' },
  });
  const position = await prisma.contestPosition.create({
    data: { contestId: contest.id, name: `Cargo UI ${suffix}`, vacancies: 3 },
  });
  const sourceUrl = `https://example.gov.br/resultados/ui-${suffix}.pdf`;

  await prisma.officialRankingRow.createMany({
    data: [90, 80, 70, 60].map((score, index) => ({
      contestId: contest.id,
      positionId: position.id,
      candidateKey: `ui-candidate-${suffix}-${index}`,
      score,
      rank: index + 1,
      category: 'GENERAL',
      sourceUrl,
      sourcePage: 7,
    })),
  });

  try {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
    await page.getByPlaceholder('Nome').fill('A8 Ranking UI');
    await page.getByPlaceholder('E-mail').fill(email);
    await page.getByPlaceholder('Senha').fill('Playwright123!');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('link', { name: 'Estimador' }).click();
    await expect(page).toHaveURL(/\/ranking$/);
    await expect(page.getByRole('heading', { name: 'Estimador de classificação' })).toBeVisible();
    await expect(page.getByLabel('Concurso')).toContainText(`Concurso UI ${suffix}`);
    await page.getByLabel('Concurso').selectOption(contest.id);
    await page.getByLabel('Cargo / modalidade').selectOption(position.id);
    await page.getByLabel('Sua pontuação simulada').fill('75,5');
    await page.getByRole('button', { name: 'Estimar posição' }).click();

    await expect(page.getByText('~ 3º lugar')).toBeVisible();
    await expect(page.getByText(/Faixa estimada:/)).toBeVisible();
    await expect(page.getByText(/não substitui o resultado publicado/i)).toBeVisible();
    await page.getByText('Fontes utilizadas').click();
    await expect(page.getByRole('link', { name: 'Documento oficial' })).toHaveAttribute('href', sourceUrl);
  } finally {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.officialRankingRow.deleteMany({ where: { contestId: contest.id } });
    await prisma.contestPosition.delete({ where: { id: position.id } });
    await prisma.contest.delete({ where: { id: contest.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
  }
});
