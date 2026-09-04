import { expect, test } from '@playwright/test';

test('exposes application and database readiness without caching', async ({ request }) => {
  const response = await request.get('/api/health', {
    headers: { 'x-request-id': 'e2e-health-request' },
  });

  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(response.headers()['x-request-id']).toBe('e2e-health-request');

  const body = await response.json();
  expect(body.status).toBe('ok');
  expect(Date.parse(body.checkedAt)).not.toBeNaN();
  expect(body.uptimeSeconds).toEqual(expect.any(Number));
  expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  expect(body.checks.database.status).toBe('ok');
  expect(body.checks.database.latencyMs).toEqual(expect.any(Number));
  expect(body.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
});
