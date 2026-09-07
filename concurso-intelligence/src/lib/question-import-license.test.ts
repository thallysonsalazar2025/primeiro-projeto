import assert from 'node:assert/strict';
import test from 'node:test';
import { validateQuestionImportBatch, type QuestionImportBatch } from './question-import.ts';

const SOURCE_HASH = 'a'.repeat(64);
const RETRIEVED_AT = '2026-09-07T00:00:00Z';

function batchWithSource(type: QuestionImportBatch['source']['type'], license?: string | null): QuestionImportBatch {
  return {
    source: {
      type,
      url: type === 'GITHUB_REPOSITORY'
        ? 'https://github.com/example/public-question-bank'
        : 'https://dados.example.gov.br/questions.json',
      sourceHash: SOURCE_HASH,
      retrievedAt: RETRIEVED_AT,
      ...(license === undefined ? {} : { license }),
    },
    board: { acronym: 'TEST', name: 'Banca de teste' },
    exam: { title: 'Prova externa licenciada', year: 2026 },
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

test('batch validation rejects reusable external sources without declared license', () => {
  for (const sourceType of ['OPEN_DATASET', 'GITHUB_REPOSITORY'] as const) {
    assert.throws(
      () => validateQuestionImportBatch(batchWithSource(sourceType)),
      new RegExp(`source\\.license é obrigatório para fonte ${sourceType}`),
    );
  }
});

test('batch validation accepts reusable external sources with declared license and pinned hash', () => {
  assert.doesNotThrow(() => validateQuestionImportBatch(batchWithSource('OPEN_DATASET', 'CC-BY-4.0')));
  assert.doesNotThrow(() => validateQuestionImportBatch(batchWithSource('GITHUB_REPOSITORY', 'MIT')));
});
