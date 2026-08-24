import assert from 'node:assert/strict';
import test from 'node:test';

import { questionFingerprint } from './question-fingerprint.ts';

const baseQuestion = {
  board: 'FGV',
  year: 2024,
  examTitle: 'DATAPREV - Analista de TI',
  number: 1,
  statement: 'Qual alternativa está correta?',
  choices: [
    { label: 'A', text: 'Primeira alternativa' },
    { label: 'B', text: 'Segunda alternativa' },
  ],
};

test('gera fingerprint SHA-256 determinístico', () => {
  const fingerprint = questionFingerprint(baseQuestion);

  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(questionFingerprint(baseQuestion), fingerprint);
});

test('normaliza caixa, espaços e ordem das alternativas', () => {
  const normalizedEquivalent = {
    ...baseQuestion,
    board: '  fgv  ',
    examTitle: 'dataprev   - analista de ti',
    statement: '  QUAL alternativa está correta?  ',
    choices: [
      { label: 'B', text: '  segunda   alternativa ' },
      { label: 'A', text: 'primeira alternativa' },
    ],
  };

  assert.equal(
    questionFingerprint(normalizedEquivalent),
    questionFingerprint(baseQuestion),
  );
});

test('altera a fingerprint quando o conteúdo relevante muda', () => {
  const changed = {
    ...baseQuestion,
    statement: 'Qual alternativa está incorreta?',
  };

  assert.notEqual(questionFingerprint(changed), questionFingerprint(baseQuestion));
});
