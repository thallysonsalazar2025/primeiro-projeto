import assert from 'node:assert/strict';
import test from 'node:test';

import { dataprevFingerprint } from './dataprev-fingerprint.ts';

const question = {
  n: 1,
  stem: '  Enunciado DATAPREV  ',
  options: [
    ['A', 'Alternativa A'],
    ['B', 'Alternativa B'],
  ] as [string, string][],
};

test('preserva o fingerprint usado pela importação DATAPREV', () => {
  const expected = '5a06a85f948fc5863bf97e4eb769d5073af36964b62312d92796f06e0b406346';

  assert.equal(dataprevFingerprint(question), expected);
});

test('ignora apenas espaços externos do enunciado, como o importador legado', () => {
  assert.equal(
    dataprevFingerprint(question),
    dataprevFingerprint({ ...question, stem: 'Enunciado DATAPREV' }),
  );
});

test('altera o fingerprint quando número ou alternativas mudam', () => {
  assert.notEqual(dataprevFingerprint(question), dataprevFingerprint({ ...question, n: 2 }));
  assert.notEqual(
    dataprevFingerprint(question),
    dataprevFingerprint({
      ...question,
      options: [
        ['A', 'Alternativa A alterada'],
        ['B', 'Alternativa B'],
      ],
    }),
  );
});
