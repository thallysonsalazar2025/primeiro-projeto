import assert from 'node:assert/strict';
import test from 'node:test';
import {
  questionSourceRequiresContentHash,
  questionSourceRequiresLicense,
  questionSourceRequiresRetrievedAt,
  validateExternalSourceHash,
  validateExternalSourceLicense,
  validateExternalSourceRetrievedAt,
} from './external-source-license.ts';

test('requires declared license for open datasets and GitHub repositories', () => {
  for (const sourceType of ['OPEN_DATASET', 'GITHUB_REPOSITORY']) {
    assert.equal(questionSourceRequiresLicense(sourceType), true);
    assert.throws(
      () => validateExternalSourceLicense(sourceType, undefined),
      new RegExp(`source\\.license é obrigatório para fonte ${sourceType}`),
    );
    assert.throws(
      () => validateExternalSourceLicense(sourceType, '   '),
      new RegExp(`source\\.license é obrigatório para fonte ${sourceType}`),
    );
  }
});

test('requires a pinned content hash for reusable external sources', () => {
  for (const sourceType of ['OPEN_DATASET', 'GITHUB_REPOSITORY']) {
    assert.equal(questionSourceRequiresContentHash(sourceType), true);
    assert.throws(
      () => validateExternalSourceHash(sourceType, undefined),
      new RegExp(`source\\.sourceHash é obrigatório para fonte ${sourceType}`),
    );
    assert.throws(
      () => validateExternalSourceHash(sourceType, '   '),
      new RegExp(`source\\.sourceHash é obrigatório para fonte ${sourceType}`),
    );
  }
});

test('requires retrieval timestamp for reusable external sources', () => {
  for (const sourceType of ['OPEN_DATASET', 'GITHUB_REPOSITORY']) {
    assert.equal(questionSourceRequiresRetrievedAt(sourceType), true);
    assert.throws(
      () => validateExternalSourceRetrievedAt(sourceType, undefined),
      new RegExp(`source\\.retrievedAt é obrigatório para fonte ${sourceType}`),
    );
    assert.throws(
      () => validateExternalSourceRetrievedAt(sourceType, '   '),
      new RegExp(`source\\.retrievedAt é obrigatório para fonte ${sourceType}`),
    );
  }
});

test('accepts required provenance metadata for reusable external sources', () => {
  const hash = 'a'.repeat(64);
  const retrievedAt = '2026-09-07T00:00:00Z';
  assert.doesNotThrow(() => validateExternalSourceLicense('OPEN_DATASET', 'CC-BY-4.0'));
  assert.doesNotThrow(() => validateExternalSourceLicense('GITHUB_REPOSITORY', 'MIT'));
  assert.doesNotThrow(() => validateExternalSourceHash('OPEN_DATASET', hash));
  assert.doesNotThrow(() => validateExternalSourceHash('GITHUB_REPOSITORY', hash));
  assert.doesNotThrow(() => validateExternalSourceRetrievedAt('OPEN_DATASET', retrievedAt));
  assert.doesNotThrow(() => validateExternalSourceRetrievedAt('GITHUB_REPOSITORY', retrievedAt));
});

test('does not require reusable-source metadata for official or manual sources', () => {
  for (const sourceType of ['OFFICIAL_PDF', 'OFFICIAL_WEB', 'MANUAL']) {
    assert.equal(questionSourceRequiresLicense(sourceType), false);
    assert.equal(questionSourceRequiresContentHash(sourceType), false);
    assert.equal(questionSourceRequiresRetrievedAt(sourceType), false);
    assert.doesNotThrow(() => validateExternalSourceLicense(sourceType, undefined));
    assert.doesNotThrow(() => validateExternalSourceHash(sourceType, undefined));
    assert.doesNotThrow(() => validateExternalSourceRetrievedAt(sourceType, undefined));
  }
});
