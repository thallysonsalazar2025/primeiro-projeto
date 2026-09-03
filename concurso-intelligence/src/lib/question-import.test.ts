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

test('rejects provenance URLs with sensitive query parameters case-insensitively', () => {
  for (const key of ['token', 'API_KEY', 'Signature']) {
    const batch = validBatch();
    batch.source.url = `https://example.gov.br/prova.pdf?${key}=secret-value`;
    assert.throws(() => validateQuestionImportBatch(batch), /parâmetro sensível/);
  }
});

test('rejects compound and provider-prefixed sensitive query parameters', () => {
  for (const key of ['client_secret', 'clientSecret', 'X-Amz-Signature']) {
    const batch = validBatch();
    batch.source.url = `https://example.gov.br/prova.pdf?${key}=secret-value`;
    assert.throws(() => validateQuestionImportBatch(batch), /parâmetro sensível/);
  }
});

test('allows non-sensitive provenance query parameters', () => {
  const batch = validBatch();
  batch.source.url = 'https://example.gov.br/prova.pdf?edicao=2026&cargo=analista';
  assert.equal(validateQuestionImportBatch(batch), batch);
});

test('validates optional board website before persistence', () => {
  const unsupported = validBatch();
  unsupported.board.website = 'ftp://example.gov.br';
  assert.throws(() => validateQuestionImportBatch(unsupported), /board\.website deve usar http ou https/);

  const credentials = validBatch();
  credentials.board.website = 'https://user:secret@example.gov.br';
  assert.throws(() => validateQuestionImportBatch(credentials), /board\.website não pode conter credenciais embutidas/);

  const sensitiveQuery = validBatch();
  sensitiveQuery.board.website = 'https://example.gov.br?clientSecret=secret-value';
  assert.throws(() => validateQuestionImportBatch(sensitiveQuery), /board\.website não pode conter parâmetro sensível/);

  const valid = validBatch();
  valid.board.website = 'https://example.gov.br/concursos?ano=2026';
  assert.equal(validateQuestionImportBatch(valid), valid);
});
