import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeOfficialQuestionExtraction,
  type OfficialQuestionExtraction,
} from './official-question-extraction.ts';

function extraction(): OfficialQuestionExtraction {
  return {
    source: {
      type: 'OFFICIAL_PDF',
      url: 'https://example.gov.br/prova.pdf',
      license: 'Uso autorizado pela fonte oficial',
      sourceHash: 'a'.repeat(64),
      retrievedAt: '2026-09-08T05:00:00Z',
    },
    answerKey: {
      url: 'https://example.gov.br/gabarito-definitivo.pdf',
      publishedAt: '2026-09-08T06:00:00Z',
    },
    board: {
      acronym: 'FGV',
      name: 'Fundação Getulio Vargas',
      website: 'https://fgv.br',
    },
    exam: {
      title: 'Analista de Sistemas',
      year: 2026,
      sourceDocument: 'prova.pdf',
      sourceSha256: 'b'.repeat(64),
    },
    questions: [
      {
        number: 1,
        statement: '  Qual alternativa está correta?  ',
        sourcePage: 3,
        sourceLabel: ' Questão 1 ',
        subject: ' Tecnologia da Informação ',
        topic: ' Java ',
        correctLabel: ' b ',
        choices: [
          { label: ' a ', text: ' Primeira ' },
          { label: ' b ', text: ' Segunda ' },
        ],
      },
    ],
  };
}

test('normaliza extração oficial para o contrato de importação preservando proveniência', () => {
  const batch = normalizeOfficialQuestionExtraction(extraction());

  assert.equal(batch.source.type, 'OFFICIAL_PDF');
  assert.equal(batch.source.url, 'https://example.gov.br/prova.pdf');
  assert.equal(batch.answerKey?.url, 'https://example.gov.br/gabarito-definitivo.pdf');
  assert.equal(batch.answerKey?.publishedAt, '2026-09-08T06:00:00Z');
  assert.equal(batch.exam.sourceDocument, 'prova.pdf');
  assert.equal(batch.questions[0].statement, 'Qual alternativa está correta?');
  assert.equal(batch.questions[0].sourcePage, 3);
  assert.equal(batch.questions[0].sourceLabel, 'Questão 1');
  assert.deepEqual(batch.questions[0].choices, [
    { label: 'A', text: 'Primeira', isCorrect: false },
    { label: 'B', text: 'Segunda', isCorrect: true },
  ]);
});

test('rejeita fonte não oficial no adaptador de prova oficial', () => {
  const input = extraction();
  input.source.type = 'OPEN_DATASET';

  assert.throws(
    () => normalizeOfficialQuestionExtraction(input),
    /source.type deve ser uma fonte oficial/,
  );
});

test('rejeita URL privada no gabarito oficial', () => {
  const input = extraction();
  input.answerKey = { url: 'http://127.0.0.1/gabarito.pdf' };

  assert.throws(
    () => normalizeOfficialQuestionExtraction(input),
    /answerKey.url/,
  );
});

test('rejeita data de publicação inválida no gabarito oficial', () => {
  const input = extraction();
  input.answerKey = {
    url: 'https://example.gov.br/gabarito.pdf',
    publishedAt: '08/09/2026',
  };

  assert.throws(
    () => normalizeOfficialQuestionExtraction(input),
    /answerKey.publishedAt deve estar em ISO-8601 UTC/,
  );
});

test('falha fechado quando o gabarito extraído não corresponde às alternativas', () => {
  const input = extraction();
  input.questions[0].correctLabel = 'C';

  assert.throws(
    () => normalizeOfficialQuestionExtraction(input),
    /correctLabel não corresponde a nenhuma alternativa/,
  );
});

test('exige gabarito para questão ativa', () => {
  const input = extraction();
  input.questions[0].correctLabel = null;

  assert.throws(
    () => normalizeOfficialQuestionExtraction(input),
    /correctLabel é obrigatório para questão não anulada/,
  );
});

test('permite questão anulada sem alternativa correta', () => {
  const input = extraction();
  input.questions[0].status = 'ANNULLED';
  input.questions[0].correctLabel = null;

  const batch = normalizeOfficialQuestionExtraction(input);
  assert.equal(batch.questions[0].status, 'ANNULLED');
  assert.equal(batch.questions[0].choices.every((choice) => !choice.isCorrect), true);
});

test('rejeita payload runtime que não seja objeto com erro de domínio', () => {
  assert.throws(
    () => normalizeOfficialQuestionExtraction(null),
    /extraction deve ser um objeto/,
  );
});

test('rejeita alternativa com shape runtime inválido antes da normalização', () => {
  const input = extraction() as unknown as Record<string, unknown>;
  const questions = input.questions as Array<Record<string, unknown>>;
  questions[0].choices = [{ label: 'A', text: 123 }];

  assert.throws(
    () => normalizeOfficialQuestionExtraction(input),
    /questions\[0\]\.choices\[0\]\.text deve ser texto/,
  );
});
