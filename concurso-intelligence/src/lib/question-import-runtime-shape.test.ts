import assert from 'node:assert/strict';
import test from 'node:test';
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

function asBatch(value: unknown) {
  return value as QuestionImportBatch;
}

test('rejects missing top-level sections with deterministic validation errors', () => {
  const batch = validBatch() as unknown as Record<string, unknown>;
  delete batch.source;
  assert.throws(() => validateQuestionImportBatch(asBatch(batch)), /source deve ser um objeto/);
});

test('rejects a non-array questions payload before iteration', () => {
  const batch = validBatch() as unknown as Record<string, unknown>;
  batch.questions = { 0: validBatch().questions[0] };
  assert.throws(() => validateQuestionImportBatch(asBatch(batch)), /questions deve ser uma lista/);
});

test('rejects malformed question and choices structures before persistence', () => {
  const malformedQuestion = validBatch() as unknown as { questions: unknown[] };
  malformedQuestion.questions = [null];
  assert.throws(
    () => validateQuestionImportBatch(asBatch(malformedQuestion)),
    /questions\[0\] deve ser um objeto/,
  );

  const malformedChoices = validBatch() as unknown as { questions: Array<Record<string, unknown>> };
  malformedChoices.questions[0].choices = 'A,B';
  assert.throws(
    () => validateQuestionImportBatch(asBatch(malformedChoices)),
    /questions\[0\]\.choices deve ser uma lista/,
  );
});

test('rejects non-boolean correctness flags instead of treating them as truthy or falsy', () => {
  const batch = validBatch() as unknown as {
    questions: Array<{ choices: Array<Record<string, unknown>> }>;
  };
  batch.questions[0].choices[0].isCorrect = 'true';
  assert.throws(
    () => validateQuestionImportBatch(asBatch(batch)),
    /questions\[0\]\.choices\[0\]\.isCorrect deve ser booleano/,
  );
});

test('rejects a missing source URL with a domain-level message', () => {
  const batch = validBatch() as unknown as { source: Record<string, unknown> };
  delete batch.source.url;
  assert.throws(() => validateQuestionImportBatch(asBatch(batch)), /source\.url não pode ser vazio/);
});

test('rejects malformed optional text fields before importer trim calls', () => {
  const sourceHash = validBatch() as unknown as { source: Record<string, unknown> };
  sourceHash.source.sourceHash = 123;
  assert.throws(() => validateQuestionImportBatch(asBatch(sourceHash)), /source\.sourceHash deve ser texto/);

  const subject = validBatch() as unknown as { questions: Array<Record<string, unknown>> };
  subject.questions[0].subject = { name: 'Tecnologia' };
  assert.throws(() => validateQuestionImportBatch(asBatch(subject)), /questions\[0\]\.subject deve ser texto/);
});

test('accepts an explicit UTC collection timestamp for provenance', () => {
  const batch = validBatch();
  batch.source.retrievedAt = '2026-09-06T10:15:30.123Z';
  assert.equal(validateQuestionImportBatch(batch), batch);
});

test('rejects malformed or offset source collection timestamps', () => {
  for (const retrievedAt of ['06/09/2026 10:15', '2026-09-06T10:15:30-03:00', '2026-13-40T99:99:99Z']) {
    const batch = validBatch();
    batch.source.retrievedAt = retrievedAt;
    assert.throws(
      () => validateQuestionImportBatch(batch),
      /source\.retrievedAt deve estar em ISO-8601 UTC/,
    );
  }
});
