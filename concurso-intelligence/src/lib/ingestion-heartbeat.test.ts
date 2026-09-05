import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestionHeartbeatMs } from './ingestion-heartbeat.ts';

test('mantém heartbeat com margem quando stale claim é 1 segundo', () => {
  const heartbeatMs = ingestionHeartbeatMs(1);

  assert.equal(heartbeatMs, 333);
  assert.ok(heartbeatMs < 1000);
});

test('usa aproximadamente um terço do limiar stale em valores usuais', () => {
  assert.equal(ingestionHeartbeatMs(3), 1000);
  assert.equal(ingestionHeartbeatMs(60), 20000);
});

test('preserva piso operacional de 100ms', () => {
  assert.equal(ingestionHeartbeatMs(0.1), 100);
});

test('não ultrapassa o maior delay suportado pelos timers do Node', () => {
  assert.equal(ingestionHeartbeatMs(10_000_000), 2_147_483_647);
});
