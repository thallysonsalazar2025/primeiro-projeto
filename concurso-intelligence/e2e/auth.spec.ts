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

test('logout from the dashboard clears the session and blocks authenticated access', async ({ page }) => {
  const email = `a2-logout-${Date.now()}@example.com`;

  await page.goto('/login');
  await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
  await page.getByPlaceholder('Nome').fill('A2 Auth');
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill('Playwright123!');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

test('account page requires authentication', async ({ page }) => {
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login$/);
});

test('authenticated user updates the profile name and sees it persisted', async ({ page }) => {
  const email = `a2-profile-${Date.now()}@example.com`;

  await page.goto('/login');
  await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
  await page.getByPlaceholder('Nome').fill('A2 Inicial');
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill('Playwright123!');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/account');
  await page.getByLabel('Nome').fill('A2 Perfil Atualizado');
  await page.getByRole('button', { name: 'Salvar perfil' }).click();
  await expect(page.getByRole('status')).toHaveText('Perfil atualizado.');

  await page.reload();
  await expect(page.getByLabel('Nome')).toHaveValue('A2 Perfil Atualizado');
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Olá, A2 Perfil Atualizado' })).toBeVisible();
});
