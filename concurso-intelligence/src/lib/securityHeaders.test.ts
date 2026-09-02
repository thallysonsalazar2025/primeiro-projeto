import assert from 'node:assert/strict';
import test from 'node:test';

import { contentSecurityPolicy, securityHeaders } from './securityHeaders.ts';

test('CSP blocks framing, plugins and non-self network access by default', () => {
  assert.match(contentSecurityPolicy, /default-src 'self'/);
  assert.match(contentSecurityPolicy, /frame-ancestors 'none'/);
  assert.match(contentSecurityPolicy, /object-src 'none'/);
  assert.match(contentSecurityPolicy, /connect-src 'self'/);
});

test('security headers publish CSP together with existing hardening headers', () => {
  const headers = new Map(securityHeaders.map(({ key, value }) => [key, value]));

  assert.equal(headers.get('Content-Security-Policy'), contentSecurityPolicy);
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('X-Frame-Options'), 'DENY');
  assert.equal(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(headers.get('Permissions-Policy'), 'camera=(), microphone=(), geolocation=()');
});
