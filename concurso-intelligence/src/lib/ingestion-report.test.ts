import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeIngestionReport } from './ingestion-report.ts';

test('serializes versioned ingestion report with batch provenance', () => {
  const serialized = serializeIngestionReport({
    schemaVersion: 1,
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
      boardAcronym: 'FGV',
      examId: 'exam-123',
      examTitle: 'Concurso Exemplo',
      examYear: 2026,
    },
  });

  assert.deepEqual(JSON.parse(serialized), {
    schemaVersion: 1,
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
      boardAcronym: 'FGV',
      examId: 'exam-123',
      examTitle: 'Concurso Exemplo',
      examYear: 2026,
    },
  });
  assert.equal(serialized.endsWith('\n'), true);
});
