import assert from 'node:assert/strict';
import test from 'node:test';
import {
  questionSourceRequiresContentHash,
  questionSourceRequiresLicense,
  validateExternalSourceHash,
  validateExternalSourceLicense,
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

test('accepts declared license and pinned hash for reusable external sources', () => {
  const hash = 'a'.repeat(64);
  assert.doesNotThrow(() => validateExternalSourceLicense('OPEN_DATASET', 'CC-BY-4.0'));
  assert.doesNotThrow(() => validateExternalSourceLicense('GITHUB_REPOSITORY', 'MIT'));
  assert.doesNotThrow(() => validateExternalSourceHash('OPEN_DATASET', hash));
  assert.doesNotThrow(() => validateExternalSourceHash('GITHUB_REPOSITORY', hash));
});

test('does not require reusable-source metadata for official or manual sources', () => {
  for (const sourceType of ['OFFICIAL_PDF', 'OFFICIAL_WEB', 'MANUAL']) {
    assert.equal(questionSourceRequiresLicense(sourceType), false);
    assert.equal(questionSourceRequiresContentHash(sourceType), false);
    assert.doesNotThrow(() => validateExternalSourceLicense(sourceType, undefined));
    assert.doesNotThrow(() => validateExternalSourceHash(sourceType, undefined));
  }
});
