import assert from 'node:assert/strict';
import test from 'node:test';

import { structuredLog } from './structured-log.ts';

test('emits one-line JSON with stable operational fields', () => {
  const lines: string[] = [];
  structuredLog('warn', 'health.database.degraded', { latencyMs: 42, requestId: 'req-1' }, {
    now: new Date('2026-09-04T05:00:00.000Z'),
    sink: (line) => lines.push(line),
  });

  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), {
    timestamp: '2026-09-04T05:00:00.000Z',
    level: 'warn',
    event: 'health.database.degraded',
    latencyMs: 42,
    requestId: 'req-1',
  });
});

test('redacts sensitive keys recursively and omits error stack', () => {
  const line = structuredLog('error', 'auth.failure', {
    authorization: 'Bearer secret',
    nested: { password: '123', tokenValue: 'abc' },
    error: new Error('database unavailable'),
  }, { sink: () => undefined });

  const payload = JSON.parse(line);
  assert.equal(payload.authorization, '[REDACTED]');
  assert.equal(payload.nested.password, '[REDACTED]');
  assert.equal(payload.nested.tokenValue, '[REDACTED]');
  assert.deepEqual(payload.error, { name: 'Error', message: 'database unavailable' });
  assert.equal('stack' in payload.error, false);
});
