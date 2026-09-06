import assert from 'node:assert/strict';
import test from 'node:test';
import { questionSourceMetadataUpdate } from './question-source-metadata.ts';

test('does not overwrite source metadata when incremental payload omits fields', () => {
  assert.deepEqual(questionSourceMetadataUpdate({}), {});
});

test('allows explicit null to clear question source metadata', () => {
  assert.deepEqual(
    questionSourceMetadataUpdate({ sourcePage: null, sourceLabel: null }),
    { sourcePage: null, sourceLabel: null },
  );
});

test('normalizes supplied source metadata values', () => {
  assert.deepEqual(
    questionSourceMetadataUpdate({ sourcePage: 7, sourceLabel: '  página 7  ' }),
    { sourcePage: 7, sourceLabel: 'página 7' },
  );
});

test('normalizes a blank explicit source label to null', () => {
  assert.deepEqual(
    questionSourceMetadataUpdate({ sourceLabel: '   ' }),
    { sourceLabel: null },
  );
});
