import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQuestionImportBatch, type QuestionImportBatch } from './question-import.ts';

function validBatch(): QuestionImportBatch {
  return {
    source: { type: 'OFFICIAL_PDF', url: 'https://example.gov.br/prova.pdf' },
    board: { acronym: 'FGV', name: 'Fundação Getulio Vargas' },
    exam: { title: 'Prova exemplo', year: 2026 },
    questions: [
      {
        number: 1,
        statement: 'Enunciado',
        choices: [
          { label: 'A', text: 'Opção A', isCorrect: true },
          { label: 'B', text: 'Opção B', isCorrect: false },
        ],
      },
    ],
  };
}

test('accepts a valid official question batch', () => {
  const batch = validBatch();
  assert.equal(validateQuestionImportBatch(batch), batch);
});

test('rejects duplicate choice labels case-insensitively', () => {
  const batch = validBatch();
  batch.questions[0].choices[1].label = 'a';
  assert.throws(() => validateQuestionImportBatch(batch), /label duplicado/);
});

test('requires exactly one correct choice for active questions', () => {
  const batch = validBatch();
  batch.questions[0].choices[1].isCorrect = true;
  assert.throws(() => validateQuestionImportBatch(batch), /exatamente uma alternativa correta/);
});

test('annulled questions must not carry a correct choice', () => {
  const batch = validBatch();
  batch.questions[0].status = 'ANNULLED';
  assert.throws(() => validateQuestionImportBatch(batch), /anulada não pode possuir alternativa correta/);

  batch.questions[0].choices[0].isCorrect = false;
  assert.equal(validateQuestionImportBatch(batch), batch);
});

test('rejects unsupported question statuses before persistence', () => {
  const batch = validBatch();
  (batch.questions[0] as { status?: string }).status = 'DRAFT';
  assert.throws(() => validateQuestionImportBatch(batch), /status inválido/);
});

test('rejects a topic without its required subject', () => {
  const batch = validBatch();
  batch.questions[0].topic = 'Arquitetura';
  assert.throws(() => validateQuestionImportBatch(batch), /topic requer subject/);
});

test('rejects non-http provenance URLs', () => {
  const batch = validBatch();
  batch.source.url = 'file:///tmp/prova.pdf';
  assert.throws(() => validateQuestionImportBatch(batch), /http ou https/);
});

test('rejects provenance URLs with embedded credentials before persistence', () => {
  const batch = validBatch();
  batch.source.url = 'https://collector:secret@example.gov.br/prova.pdf';
  assert.throws(() => validateQuestionImportBatch(batch), /credenciais embutidas/);
});
