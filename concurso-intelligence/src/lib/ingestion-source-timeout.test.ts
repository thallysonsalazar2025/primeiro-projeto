import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_INGESTION_SOURCE_TIMEOUT_MS,
  MAX_INGESTION_SOURCE_TIMEOUT_MS,
  parseIngestionSourceTimeoutMs,
} from './ingestion-source-timeout.ts';

test('usa timeout padrão quando variável não é informada', () => {
  assert.equal(parseIngestionSourceTimeoutMs(undefined), DEFAULT_INGESTION_SOURCE_TIMEOUT_MS);
  assert.equal(parseIngestionSourceTimeoutMs('  '), DEFAULT_INGESTION_SOURCE_TIMEOUT_MS);
});

test('aceita inteiro positivo em milissegundos dentro do limite do Node', () => {
  assert.equal(parseIngestionSourceTimeoutMs('15000'), 15_000);
  assert.equal(parseIngestionSourceTimeoutMs(' 2500 '), 2_500);
  assert.equal(parseIngestionSourceTimeoutMs(String(MAX_INGESTION_SOURCE_TIMEOUT_MS)), MAX_INGESTION_SOURCE_TIMEOUT_MS);
});

test('rejeita timeout inválido, não positivo ou acima do limite do Node', () => {
  for (const value of ['0', '-1', '1.5', 'abc', String(MAX_INGESTION_SOURCE_TIMEOUT_MS + 1)]) {
    assert.throws(() => parseIngestionSourceTimeoutMs(value), /INGESTION_SOURCE_TIMEOUT_MS/);
  }
});
