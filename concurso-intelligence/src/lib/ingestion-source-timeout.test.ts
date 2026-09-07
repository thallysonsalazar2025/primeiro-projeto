import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_INGESTION_SOURCE_TIMEOUT_MS,
  parseIngestionSourceTimeoutMs,
} from './ingestion-source-timeout.ts';

test('usa timeout padrão quando variável não é informada', () => {
  assert.equal(parseIngestionSourceTimeoutMs(undefined), DEFAULT_INGESTION_SOURCE_TIMEOUT_MS);
  assert.equal(parseIngestionSourceTimeoutMs('  '), DEFAULT_INGESTION_SOURCE_TIMEOUT_MS);
});

test('aceita inteiro positivo em milissegundos', () => {
  assert.equal(parseIngestionSourceTimeoutMs('15000'), 15_000);
  assert.equal(parseIngestionSourceTimeoutMs(' 2500 '), 2_500);
});

test('rejeita timeout inválido ou não positivo', () => {
  for (const value of ['0', '-1', '1.5', 'abc']) {
    assert.throws(() => parseIngestionSourceTimeoutMs(value), /inteiro positivo/);
  }
});
