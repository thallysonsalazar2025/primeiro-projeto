import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyStudySignal } from './studySignal.ts';

test('classifies study signal thresholds with minimum sample', () => {
  assert.equal(classifyStudySignal(4, 100), 'insufficient');
  assert.equal(classifyStudySignal(5, 59.9), 'weak');
  assert.equal(classifyStudySignal(5, 60), 'stable');
  assert.equal(classifyStudySignal(5, 79.9), 'stable');
  assert.equal(classifyStudySignal(5, 80), 'strong');
});
