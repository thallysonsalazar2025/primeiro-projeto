import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeIngestionReport } from './ingestion-report.ts';

test('serializes ingestion report as stable machine-readable JSON', () => {
  const serialized = serializeIngestionReport({
    created: 3,
    updated: 2,
    duplicates: 1,
    rejected: 0,
    verified: 6,
  });

  assert.deepEqual(JSON.parse(serialized), {
    created: 3,
    updated: 2,
    duplicates: 1,
    rejected: 0,
    verified: 6,
  });
  assert.equal(serialized.endsWith('\n'), true);
});
