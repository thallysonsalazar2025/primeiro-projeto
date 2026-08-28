import assert from 'node:assert/strict';
import test from 'node:test';

import { nextReviewQuestionIds } from './review-markers.ts';

test('adds a question only once when marking for review', () => {
  assert.deepEqual(nextReviewQuestionIds(['q1'], 'q2', true), ['q1', 'q2']);
  assert.deepEqual(nextReviewQuestionIds(['q1', 'q2'], 'q2', true), ['q1', 'q2']);
});

test('removes only the requested question when unmarking', () => {
  assert.deepEqual(nextReviewQuestionIds(['q1', 'q2', 'q3'], 'q2', false), ['q1', 'q3']);
});

test('is idempotent when unmarking an absent question', () => {
  assert.deepEqual(nextReviewQuestionIds(['q1'], 'q2', false), ['q1']);
});
