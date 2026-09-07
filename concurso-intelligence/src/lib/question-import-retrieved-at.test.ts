import assert from 'node:assert/strict';
import test from 'node:test';
import { validateQuestionImportBatch, type QuestionImportBatch } from './question-import.ts';

const SOURCE_HASH = 'b'.repeat(64);

function batchWithRetrievedAt(
  type: QuestionImportBatch['source']['type'],
  retrievedAt?: string | null,
): QuestionImportBatch {
  return {
    source: {
      type,
      url: type === 'GITHUB_REPOSITORY'
        ? 'https://github.com/example/public-question-bank'
        : 'https://dados.example.gov.br/questions.json',
      license: type === 'GITHUB_REPOSITORY' ? 'MIT' : 'CC-BY-4.0',
      sourceHash: SOURCE_HASH,
      ...(retrievedAt === undefined ? {} : { retrievedAt }),
    },
    board: { acronym: 'TEST', name: 'Banca de teste' },
    exam: { title: 'Prova externa coletada', year: 2026 },
    questions: [
      {
        number: 1,
        statement: 'Enunciado de teste',
        choices: [
          { label: 'A', text: 'Correta', isCorrect: true },
          { label: 'B', text: 'Incorreta', isCorrect: false },
        ],
      },
    ],
  };
}

test('batch validation rejects reusable external sources without retrieval timestamp', () => {
  for (const sourceType of ['OPEN_DATASET', 'GITHUB_REPOSITORY'] as const) {
    assert.throws(
      () => validateQuestionImportBatch(batchWithRetrievedAt(sourceType)),
      new RegExp(`source\\.retrievedAt é obrigatório para fonte ${sourceType}`),
    );
  }
});

test('batch validation rejects blank or malformed retrieval timestamp', () => {
  assert.throws(
    () => validateQuestionImportBatch(batchWithRetrievedAt('OPEN_DATASET', '   ')),
    /source\.retrievedAt é obrigatório para fonte OPEN_DATASET/,
  );
  assert.throws(
    () => validateQuestionImportBatch(batchWithRetrievedAt('OPEN_DATASET', '2026-09-07')),
    /source\.retrievedAt deve estar em ISO-8601 UTC/,
  );
});

test('batch validation accepts reusable external sources with retrieval timestamp', () => {
  const retrievedAt = '2026-09-07T00:00:00Z';
  assert.doesNotThrow(() => validateQuestionImportBatch(batchWithRetrievedAt('OPEN_DATASET', retrievedAt)));
  assert.doesNotThrow(() => validateQuestionImportBatch(batchWithRetrievedAt('GITHUB_REPOSITORY', retrievedAt)));
});

test('official and manual sources remain compatible without retrieval timestamp', () => {
  for (const sourceType of ['OFFICIAL_PDF', 'OFFICIAL_WEB', 'MANUAL'] as const) {
    const batch = batchWithRetrievedAt(sourceType);
    delete batch.source.license;
    delete batch.source.sourceHash;
    assert.doesNotThrow(() => validateQuestionImportBatch(batch));
  }
});
