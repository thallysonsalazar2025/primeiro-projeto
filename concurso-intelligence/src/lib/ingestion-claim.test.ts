import assert from 'node:assert/strict';
import test from 'node:test';

import { isIngestionClaimContention } from './ingestion-claim.ts';

test('trata ENOENT como contenção normal de claim entre workers', () => {
  const error = Object.assign(new Error('arquivo já reivindicado'), { code: 'ENOENT' });
  assert.equal(isIngestionClaimContention(error), true);
});

test('não mascara erros reais de filesystem durante o claim', () => {
  for (const code of ['EACCES', 'EPERM', 'EIO']) {
    const error = Object.assign(new Error(code), { code });
    assert.equal(isIngestionClaimContention(error), false);
  }
  assert.equal(isIngestionClaimContention(new Error('sem code')), false);
});
