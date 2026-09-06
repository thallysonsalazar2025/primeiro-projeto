import assert from 'node:assert/strict';
import test from 'node:test';
import { nextExamSourceMetadata } from './exam-source-metadata.ts';

test('uses a newly supplied source metadata value', () => {
  assert.equal(nextExamSourceMetadata('old.pdf', ' new.pdf '), 'new.pdf');
});

test('preserves known source metadata when a later batch omits it', () => {
  assert.equal(nextExamSourceMetadata('known.pdf', undefined), 'known.pdf');
  assert.equal(nextExamSourceMetadata('a'.repeat(64), null), 'a'.repeat(64));
  assert.equal(nextExamSourceMetadata('known.pdf', '   '), 'known.pdf');
});

test('keeps null when neither existing nor incoming metadata is known', () => {
  assert.equal(nextExamSourceMetadata(null, undefined), null);
  assert.equal(nextExamSourceMetadata(null, '  '), null);
});
