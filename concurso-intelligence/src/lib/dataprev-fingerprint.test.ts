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
  const expected = '8bd13228e929b62203e5cb4c62a3efe6c748f6cbf091c2bb8b74fed778c0be3d';

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
