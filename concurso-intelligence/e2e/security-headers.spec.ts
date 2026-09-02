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

test('adds and preserves a valid request correlation id', async ({ request }) => {
  const generated = await request.get('/login');
  const generatedRequestId = generated.headers()['x-request-id'];

  expect(generatedRequestId).toBeTruthy();
  expect(generatedRequestId).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);

  const providedRequestId = 'support-case-123';
  const preserved = await request.get('/login', {
    headers: {
      'x-request-id': providedRequestId,
    },
  });

  expect(preserved.headers()['x-request-id']).toBe(providedRequestId);
});

test('replaces malformed request correlation ids', async ({ request }) => {
  const malformed = '<script>alert(1)</script>';
  const response = await request.get('/login', {
    headers: {
      'x-request-id': malformed,
    },
  });

  expect(response.headers()['x-request-id']).toBeTruthy();
  expect(response.headers()['x-request-id']).not.toBe(malformed);
  expect(response.headers()['x-request-id']).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
});
