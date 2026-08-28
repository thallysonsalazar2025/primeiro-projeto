import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateSimulationResult } from './simulation-result.ts';

test('calculates correct, incorrect, blank and accuracy', () => {
  const result = calculateSimulationResult(5, [
    { selected: 'A', correct: true, elapsedMs: 1000 },
    { selected: 'B', correct: false, elapsedMs: 2000 },
    { selected: null, correct: false, elapsedMs: 500 },
  ]);

  assert.deepEqual(result, {
    totalQuestions: 5,
    answered: 2,
    correct: 1,
    incorrect: 1,
    blank: 3,
    accuracy: 0.5,
    elapsedMs: 3500,
  });
});

test('returns zero accuracy when nothing was answered', () => {
  const result = calculateSimulationResult(2, [
    { selected: null, correct: false, elapsedMs: null },
  ]);

  assert.equal(result.answered, 0);
  assert.equal(result.correct, 0);
  assert.equal(result.incorrect, 0);
  assert.equal(result.blank, 2);
  assert.equal(result.accuracy, 0);
  assert.equal(result.elapsedMs, 0);
});

test('never returns a negative blank count', () => {
  const result = calculateSimulationResult(1, [
    { selected: 'A', correct: true, elapsedMs: 1 },
    { selected: 'B', correct: false, elapsedMs: 1 },
  ]);

  assert.equal(result.blank, 0);
});
