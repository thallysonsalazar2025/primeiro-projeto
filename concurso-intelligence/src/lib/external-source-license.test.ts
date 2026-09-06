import assert from 'node:assert/strict';
import test from 'node:test';
import {
  questionSourceRequiresLicense,
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

test('accepts a non-blank declared license for reusable external sources', () => {
  assert.doesNotThrow(() => validateExternalSourceLicense('OPEN_DATASET', 'CC-BY-4.0'));
  assert.doesNotThrow(() => validateExternalSourceLicense('GITHUB_REPOSITORY', 'MIT'));
});

test('does not require license metadata for official or manual sources', () => {
  for (const sourceType of ['OFFICIAL_PDF', 'OFFICIAL_WEB', 'MANUAL']) {
    assert.equal(questionSourceRequiresLicense(sourceType), false);
    assert.doesNotThrow(() => validateExternalSourceLicense(sourceType, undefined));
  }
});
