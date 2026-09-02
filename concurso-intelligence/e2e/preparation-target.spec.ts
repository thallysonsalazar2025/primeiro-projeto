import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('persists the authenticated user preparation target from the dashboard', async ({ page }) => {
  test.setTimeout(60_000);

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `a3-target-${suffix}@example.com`;
  const contest = await prisma.contest.create({
    data: { name: `Concurso Alvo ${suffix}`, year: 2026 },
  });
  const position = await prisma.contestPosition.create({
    data: { contestId: contest.id, name: `Analista Alvo ${suffix}`, area: 'Tecnologia', vacancies: 8 },
  });

  try {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
    await page.getByPlaceholder('Nome').fill('A3 Target E2E');
    await page.getByPlaceholder('E-mail').fill(email);
    await page.getByPlaceholder('Senha').fill('Playwright123!');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const selectByField = (label: string) => page
      .locator('label')
      .filter({ has: page.getByText(label, { exact: true }) })
      .locator('select');

    await selectByField('Concurso').selectOption({ label: `${contest.name} · 2026` });
    await selectByField('Cargo').selectOption({ label: `${position.name} · Tecnologia` });
    await page.getByLabel('Nota-alvo (opcional)').fill('82.5');
    await page.getByRole('button', { name: 'Salvar preparatório' }).click();
    await expect(page.getByRole('status')).toContainText('Preparatório salvo');

    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    const saved = await prisma.userContestTarget.findFirst({
      where: { userId: user.id, contestId: contest.id, positionId: position.id },
    });
    expect(saved).not.toBeNull();
    expect(Number(saved?.targetScore)).toBe(82.5);

    const response = await page.request.get('/api/preparation-targets');
    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.targets).toContainEqual(expect.objectContaining({
      contest: expect.objectContaining({ id: contest.id, name: contest.name, year: 2026 }),
      position: expect.objectContaining({ id: position.id, name: position.name, area: position.area }),
      targetScore: 82.5,
    }));
  } finally {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await prisma.contest.delete({ where: { id: contest.id } });
  }
});
