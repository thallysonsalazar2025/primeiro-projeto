import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('keeps the authenticated dashboard usable without horizontal page overflow on mobile', async ({ page }) => {
  test.setTimeout(60_000);

  const email = `a9-mobile-${Date.now()}@example.com`;

  await page.goto('/login');
  await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
  await page.getByPlaceholder('Nome').fill('A9 QA Mobile');
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill('Playwright123!');
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('navigation', { name: 'Navegação do dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Olá,/ })).toBeVisible();

  const documentOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(documentOverflow.scrollWidth).toBeLessThanOrEqual(documentOverflow.clientWidth);

  const nav = page.getByRole('navigation', { name: 'Navegação do dashboard' });
  const navBox = await nav.boundingBox();
  expect(navBox).not.toBeNull();
  expect(navBox!.x).toBeGreaterThanOrEqual(0);
  expect(navBox!.width).toBeLessThanOrEqual(390);

  await expect(page.getByText('Questões respondidas', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Preparatório inteligente' })).toBeVisible();
});
