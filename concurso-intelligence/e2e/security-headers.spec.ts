import { expect, test } from '@playwright/test';

test('serves the V2 with the baseline security headers', async ({ request }) => {
  const response = await request.get('/login');

  expect(response.ok()).toBeTruthy();

  const headers = response.headers();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
});
