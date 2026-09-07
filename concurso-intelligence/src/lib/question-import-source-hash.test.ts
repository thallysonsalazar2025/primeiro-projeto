import assert from 'node:assert/strict';
import test from 'node:test';
import { validateQuestionImportBatch, type QuestionImportBatch } from './question-import.ts';

function batchWithSourceHash(
  type: QuestionImportBatch['source']['type'],
  sourceHash?: string | null,
): QuestionImportBatch {
  return {
    source: {
      type,
      url: type === 'GITHUB_REPOSITORY'
        ? 'https://github.com/example/public-question-bank'
        : 'https://dados.example.gov.br/questions.json',
      license: type === 'GITHUB_REPOSITORY' ? 'MIT' : 'CC-BY-4.0',
      ...(sourceHash === undefined ? {} : { sourceHash }),
    },
    board: { acronym: 'TEST', name: 'Banca de teste' },
    exam: { title: 'Prova externa versionada', year: 2026 },
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

test('batch validation rejects reusable external sources without pinned source hash', () => {
  for (const sourceType of ['OPEN_DATASET', 'GITHUB_REPOSITORY'] as const) {
    assert.throws(
      () => validateQuestionImportBatch(batchWithSourceHash(sourceType)),
      new RegExp(`source\\.sourceHash é obrigatório para fonte ${sourceType}`),
    );
  }
});

test('batch validation rejects malformed source hash before persistence', () => {
  assert.throws(
    () => validateQuestionImportBatch(batchWithSourceHash('OPEN_DATASET', 'not-a-sha256')),
    /source\.sourceHash deve conter um SHA-256 hexadecimal de 64 caracteres/,
  );
});

test('batch validation accepts reusable external sources with pinned source hash', () => {
  const sourceHash = 'b'.repeat(64);
  assert.doesNotThrow(() => validateQuestionImportBatch(batchWithSourceHash('OPEN_DATASET', sourceHash)));
  assert.doesNotThrow(() => validateQuestionImportBatch(batchWithSourceHash('GITHUB_REPOSITORY', sourceHash)));
});

test('official and manual sources remain compatible without source hash', () => {
  for (const sourceType of ['OFFICIAL_PDF', 'OFFICIAL_WEB', 'MANUAL'] as const) {
    const batch = batchWithSourceHash(sourceType);
    delete batch.source.license;
    assert.doesNotThrow(() => validateQuestionImportBatch(batch));
  }
});
