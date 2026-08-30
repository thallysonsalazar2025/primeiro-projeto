import { expect, test } from '@playwright/test';

test('registers a user and reaches the authenticated dashboard', async ({ page }) => {
  const email = `a9-e2e-${Date.now()}@example.com`;

  await page.goto('/login');
  await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
  await page.getByPlaceholder('Nome').fill('A9 QA');
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill('Playwright123!');
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('Concurso Intelligence').first()).toBeVisible();
});

test('logout clears the session and blocks the authenticated dashboard', async ({ page }) => {
  const email = `a2-logout-${Date.now()}@example.com`;

  await page.goto('/login');
  await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
  await page.getByPlaceholder('Nome').fill('A2 Auth');
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill('Playwright123!');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const logout = await page.request.post('/api/auth/logout');
  expect(logout.ok()).toBeTruthy();

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});
