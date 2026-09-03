import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeIngestionReport } from './ingestion-report.ts';

test('serializes ingestion report as stable machine-readable JSON with batch provenance', () => {
  const serialized = serializeIngestionReport({
    created: 3,
    updated: 2,
    duplicates: 1,
    rejected: 0,
    verified: 6,
    batch: {
      generatedAt: '2026-09-03T09:00:00.000Z',
      inputSha256: 'a'.repeat(64),
      sourceType: 'OFFICIAL_PDF',
      sourceUrl: 'https://example.gov.br/prova.pdf',
      examTitle: 'Concurso Exemplo',
      examYear: 2026,
    },
  });

  assert.deepEqual(JSON.parse(serialized), {
    created: 3,
    updated: 2,
    duplicates: 1,
    rejected: 0,
    verified: 6,
    batch: {
      generatedAt: '2026-09-03T09:00:00.000Z',
      inputSha256: 'a'.repeat(64),
      sourceType: 'OFFICIAL_PDF',
      sourceUrl: 'https://example.gov.br/prova.pdf',
      examTitle: 'Concurso Exemplo',
      examYear: 2026,
    },
  });
  assert.equal(serialized.endsWith('\n'), true);
});
