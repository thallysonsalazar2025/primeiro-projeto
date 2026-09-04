import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAX_INGESTION_FILE_BYTES,
  assertIngestionFileSize,
  parseMaxIngestionFileBytes,
} from './ingestion-file-size.ts';

test('uses a 10 MiB default ingestion file limit', () => {
  assert.equal(parseMaxIngestionFileBytes(undefined), DEFAULT_MAX_INGESTION_FILE_BYTES);
});

test('accepts a configured positive safe integer limit', () => {
  assert.equal(parseMaxIngestionFileBytes('2048'), 2048);
});

test('rejects invalid configured limits', () => {
  for (const value of ['0', '-1', '1.5', 'abc']) {
    assert.throws(() => parseMaxIngestionFileBytes(value), /INGESTION_MAX_FILE_BYTES inválido/);
  }
});

test('accepts a file exactly at the limit and rejects an oversized file', () => {
  assert.doesNotThrow(() => assertIngestionFileSize(1024, 1024));
  assert.throws(() => assertIngestionFileSize(1025, 1024), /excede o limite de 1024 bytes/);
});
