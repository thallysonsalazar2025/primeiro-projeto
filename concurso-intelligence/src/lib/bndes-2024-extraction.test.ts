import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBndes2024OfficialExtraction,
  parseBndes2024AnswerKey,
  parseBndes2024ExamPages,
} from './bndes-2024-extraction.ts';
import { normalizeOfficialQuestionExtraction } from './official-question-extraction.ts';

const metadata = {
  source: {
    type: 'OFFICIAL_PDF' as const,
    url: 'https://www.bndes.gov.br/prova.pdf',
    license: null,
    sourceHash: 'a'.repeat(64),
    retrievedAt: '2026-09-10T00:00:00.000Z',
  },
  answerKey: {
    url: 'https://www.bndes.gov.br/gabarito.pdf',
  },
  board: {
    acronym: 'CESGRANRIO',
    name: 'Fundação Cesgranrio',
    website: 'https://www.cesgranrio.org.br',
  },
  exam: {
    title: 'BNDES 2024 - Análise de Sistemas - Desenvolvimento',
    year: 2024,
    sourceDocument: 'prova.pdf',
    sourceSha256: 'a'.repeat(64),
  },
};

test('extrai questões e cruza gabarito antes da normalização', () => {
  const extraction = buildBndes2024OfficialExtraction(
    [
      {
        page: 10,
        text: [
          '1. Qual alternativa descreve melhor o conceito?',
          'A) Primeira resposta',
          'B) Segunda resposta',
          'C) Terceira resposta',
          'D) Quarta resposta',
          'E) Quinta resposta',
          '2. Questão anulada pela banca',
          'A) Uma',
          'B) Duas',
          'C) Três',
          'D) Quatro',
          'E) Cinco',
        ].join('\n'),
      },
    ],
    '1 B 2 ANULADA',
    metadata,
  );

  assert.equal(extraction.questions.length, 2);
  assert.equal(extraction.questions[0]?.correctLabel, 'B');
  assert.equal(extraction.questions[0]?.sourcePage, 10);
  assert.equal(extraction.questions[1]?.status, 'ANNULLED');
  assert.equal(extraction.questions[1]?.correctLabel, null);

  const batch = normalizeOfficialQuestionExtraction(extraction);
  assert.equal(batch.questions[0]?.choices.filter((choice) => choice.isCorrect).length, 1);
  assert.equal(batch.questions[1]?.choices.filter((choice) => choice.isCorrect).length, 0);
});

test('preserva texto de enunciado e alternativa em múltiplas linhas', () => {
  const questions = parseBndes2024ExamPages([
    {
      page: 3,
      text: [
        '7) Considere o cenário a seguir',
        'com uma continuação do enunciado.',
        'A) alternativa que continua',
        'na linha seguinte',
        'B) segunda alternativa',
      ].join('\n'),
    },
  ]);

  assert.equal(questions[0]?.statement, 'Considere o cenário a seguir com uma continuação do enunciado.');
  assert.equal(questions[0]?.choices[0]?.text, 'alternativa que continua na linha seguinte');
});

test('falha fechada para questão sem gabarito', () => {
  assert.throws(
    () => buildBndes2024OfficialExtraction(
      [{ page: 1, text: '1. Pergunta\nA) Um\nB) Dois' }],
      '2 A',
      metadata,
    ),
    /questão 1 não encontrada no gabarito final/,
  );
});

test('falha fechada para gabarito com questão ausente no caderno', () => {
  assert.throws(
    () => buildBndes2024OfficialExtraction(
      [{ page: 1, text: '1. Pergunta\nA) Um\nB) Dois' }],
      '1 A 2 B',
      metadata,
    ),
    /gabarito contém questões ausentes no caderno: 2/,
  );
});

test('rejeita duplicidade de número no caderno e no gabarito', () => {
  assert.throws(
    () => parseBndes2024ExamPages([
      { page: 1, text: '1. A\nA) Um\nB) Dois\n1. B\nA) Um\nB) Dois' },
    ]),
    /questão 1 duplicada no caderno/,
  );

  assert.throws(
    () => parseBndes2024AnswerKey('1 A 1 B'),
    /questão 1 duplicada no gabarito/,
  );
});
