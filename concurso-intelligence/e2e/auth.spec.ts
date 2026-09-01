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

test('authenticated user sees recent access history without exposing IP data', async ({ page }) => {
  const email = `a2-history-${Date.now()}@example.com`;
  const password = 'Playwright123!';

  await page.goto('/login');
  await page.getByRole('button', { name: 'Ainda não tenho conta' }).click();
  await page.getByPlaceholder('Nome').fill('A2 Histórico');
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill(password);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await page.getByPlaceholder('E-mail').fill(email);
  await page.getByPlaceholder('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Acessos recentes' })).toBeVisible();
  await expect(page.getByLabel('Histórico de acessos').getByRole('listitem')).toHaveCount(2);
  await expect(page.getByText('Acesso mais recente')).toBeVisible();
  await expect(page.getByText(/endereço IP não é exibido/i)).toBeVisible();
});

test('login API rate limits repeated invalid attempts and returns Retry-After', async ({ request }) => {
  const email = `a10-rate-limit-${Date.now()}@example.com`;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request.post('/api/auth/login', {
      data: { email, password: 'WrongPassword123!' },
    });
    expect(response.status()).toBe(401);
  }

  const blocked = await request.post('/api/auth/login', {
    data: { email, password: 'WrongPassword123!' },
  });
  expect(blocked.status()).toBe(429);
  expect(Number(blocked.headers()['retry-after'])).toBeGreaterThan(0);
});
