import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nextProvenanceHash,
  shouldCreateProvenanceRevision,
} from './question-provenance.ts';

test('creates a provenance revision when the same source URL arrives with a different hash', () => {
  assert.equal(shouldCreateProvenanceRevision('a'.repeat(64), 'b'.repeat(64)), true);
});

test('does not create a revision for the same hash regardless of casing', () => {
  assert.equal(shouldCreateProvenanceRevision('A'.repeat(64), 'a'.repeat(64)), false);
});

test('does not invent a revision when either side has no hash', () => {
  assert.equal(shouldCreateProvenanceRevision(null, 'b'.repeat(64)), false);
  assert.equal(shouldCreateProvenanceRevision('a'.repeat(64), null), false);
});

test('keeps the last known hash when a later batch omits it', () => {
  assert.equal(nextProvenanceHash('a'.repeat(64), null), 'a'.repeat(64));
  assert.equal(nextProvenanceHash(null, 'b'.repeat(64)), 'b'.repeat(64));
});
