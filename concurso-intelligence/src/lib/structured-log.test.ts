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
    latencyMs: 42,
    requestId: 'req-1',
    timestamp: '2026-09-04T05:00:00.000Z',
    level: 'warn',
    event: 'health.database.degraded',
  });
});

test('redacts sensitive keys recursively and does not serialize error details', () => {
  const line = structuredLog('error', 'auth.failure', {
    authorization: 'Bearer secret',
    nested: { password: '123', tokenValue: 'abc' },
    error: new Error('postgres://user:password@host/database'),
  }, { sink: () => undefined });

  const payload = JSON.parse(line);
  assert.equal(payload.authorization, '[REDACTED]');
  assert.equal(payload.nested.password, '[REDACTED]');
  assert.equal(payload.nested.tokenValue, '[REDACTED]');
  assert.deepEqual(payload.error, { name: 'Error' });
});

test('does not let caller fields overwrite the log envelope', () => {
  const line = structuredLog('error', 'health.database.degraded', {
    level: 'info',
    event: 'spoofed',
    timestamp: '2000-01-01T00:00:00.000Z',
  }, {
    now: new Date('2026-09-04T05:00:00.000Z'),
    sink: () => undefined,
  });

  const payload = JSON.parse(line);
  assert.equal(payload.level, 'error');
  assert.equal(payload.event, 'health.database.degraded');
  assert.equal(payload.timestamp, '2026-09-04T05:00:00.000Z');
});

test('handles circular arrays without crashing the logger', () => {
  const circular: unknown[] = [];
  circular.push(circular);

  const line = structuredLog('warn', 'diagnostic.circular', { circular }, { sink: () => undefined });
  assert.deepEqual(JSON.parse(line).circular, ['[Circular]']);
});

test('preserves dates as ISO strings', () => {
  const line = structuredLog('info', 'job.scheduled', {
    scheduledAt: new Date('2026-09-04T06:00:00.000Z'),
  }, { sink: () => undefined });

  assert.equal(JSON.parse(line).scheduledAt, '2026-09-04T06:00:00.000Z');
});

test('drops toJSON hooks so they cannot bypass redaction', () => {
  const diagnostic = {
    password: 'super-secret',
    toJSON() {
      return { leakedPassword: this.password };
    },
  };

  const line = structuredLog('error', 'diagnostic.serialize', { diagnostic }, { sink: () => undefined });
  const payload = JSON.parse(line);

  assert.deepEqual(payload.diagnostic, { password: '[REDACTED]' });
  assert.equal(JSON.stringify(payload).includes('super-secret'), false);
});
