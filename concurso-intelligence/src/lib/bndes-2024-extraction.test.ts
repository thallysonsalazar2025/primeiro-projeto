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

const answerKey = (entries: string) => [
  'ANÁLISE DE SISTEMAS - DESENVOLVIMENTO',
  entries,
  'PERFIL: ANÁLISE DE SISTEMAS - SUPORTE',
  '1 A 2 B 3 C',
].join('\n');

const fiveChoices = [
  'A) Primeira resposta',
  'B) Segunda resposta',
  'C) Terceira resposta',
  'D) Quarta resposta',
  'E) Quinta resposta',
];

test('extrai questões e cruza somente a seção Desenvolvimento do gabarito', () => {
  const extraction = buildBndes2024OfficialExtraction(
    [
      {
        page: 10,
        text: [
          '1. Qual alternativa descreve melhor o conceito?',
          ...fiveChoices,
          '2. Questão anulada pela banca',
          'A) Uma',
          'B) Duas',
          'C) Três',
          'D) Quatro',
          'E) Cinco',
        ].join('\n'),
      },
    ],
    answerKey('1 B 2 ANULADA'),
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
  assert.equal(batch.answerKey?.url, metadata.answerKey.url);
});

test('aceita marcadores reais com número isolado e alternativas parentetizadas', () => {
  const questions = parseBndes2024ExamPages([
    {
      page: 3,
      text: [
        '7',
        'Considere o cenário a seguir',
        '(A) alternativa um',
        '(B) alternativa dois',
        '(C) alternativa três',
        '(D) alternativa quatro',
        '(E) alternativa cinco',
      ].join('\n'),
    },
  ]);

  assert.equal(questions[0]?.number, 7);
  assert.equal(questions[0]?.choices.length, 5);
  assert.equal(questions[0]?.choices[0]?.label, 'A');
});

test('preserva estrutura multiline sem colapsar quebras significativas', () => {
  const questions = parseBndes2024ExamPages([
    {
      page: 3,
      text: [
        '7) Considere o SQL:',
        'SELECT *',
        'FROM tabela',
        'A) alternativa que continua',
        'na linha seguinte',
        'B) segunda alternativa',
        'C) terceira alternativa',
        'D) quarta alternativa',
        'E) quinta alternativa',
      ].join('\n'),
    },
  ]);

  assert.equal(questions[0]?.statement, 'Considere o SQL:\nSELECT *\nFROM tabela');
  assert.equal(questions[0]?.choices[0]?.text, 'alternativa que continua\nna linha seguinte');
});

test('ignora mobiliário de página em vez de incorporá-lo à alternativa', () => {
  const questions = parseBndes2024ExamPages([
    {
      page: 8,
      text: [
        '1. Pergunta',
        ...fiveChoices,
        'FUNDAÇÃO CESGRANRIO',
        'BNDES 2024',
      ].join('\n'),
    },
  ]);

  assert.equal(questions[0]?.choices[4]?.text, 'Quinta resposta');
});

test('falha fechada se faltar qualquer alternativa A-E', () => {
  assert.throws(
    () => parseBndes2024ExamPages([
      { page: 1, text: '1. Pergunta\nA) Um\nB) Dois\nC) Três\nD) Quatro' },
    ]),
    /exatamente as alternativas A-E/,
  );
});

test('falha fechada para questão sem gabarito', () => {
  assert.throws(
    () => buildBndes2024OfficialExtraction(
      [{ page: 1, text: ['1. Pergunta', ...fiveChoices].join('\n') }],
      answerKey('2 A'),
      metadata,
    ),
    /questão 1 não encontrada no gabarito final/,
  );
});

test('falha fechada para gabarito com questão ausente no caderno', () => {
  assert.throws(
    () => buildBndes2024OfficialExtraction(
      [{ page: 1, text: ['1. Pergunta', ...fiveChoices].join('\n') }],
      answerKey('1 A 2 B'),
      metadata,
    ),
    /gabarito contém questões ausentes no caderno: 2/,
  );
});

test('rejeita duplicidade dentro da seção Desenvolvimento sem ser confundido por outro perfil', () => {
  assert.throws(
    () => parseBndes2024AnswerKey(answerKey('1 A 1 B')),
    /questão 1 duplicada no gabarito da seção Desenvolvimento/,
  );

  const answers = parseBndes2024AnswerKey(answerKey('1 A 2 B'));
  assert.equal(answers.size, 2);
});

test('rejeita gabarito sem seção Desenvolvimento e exige proveniência', () => {
  assert.throws(
    () => parseBndes2024AnswerKey('1 A 2 B'),
    /seção de Análise de Sistemas - Desenvolvimento não encontrada/,
  );

  assert.throws(
    () => buildBndes2024OfficialExtraction(
      [{ page: 1, text: ['1. Pergunta', ...fiveChoices].join('\n') }],
      answerKey('1 A'),
      { ...metadata, answerKey: { url: '' } },
    ),
    /URL do gabarito final é obrigatória/,
  );
});
