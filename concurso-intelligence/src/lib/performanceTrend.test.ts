import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyPerformanceTrend } from './performanceTrend.ts';

test('requires a minimum sample in both seven-day windows', () => {
  assert.deepEqual(classifyPerformanceTrend(4, 4, 10, 10), {
    signal: 'insufficient',
    previousAccuracy: 100,
    currentAccuracy: 100,
    deltaPercentagePoints: null,
  });
});

test('classifies meaningful trend deltas at five percentage points', () => {
  assert.equal(classifyPerformanceTrend(20, 12, 20, 13).signal, 'improving');
  assert.equal(classifyPerformanceTrend(20, 13, 20, 12).signal, 'declining');
  assert.equal(classifyPerformanceTrend(20, 12, 20, 12).signal, 'stable');
});

test('returns weighted window accuracy and delta', () => {
  assert.deepEqual(classifyPerformanceTrend(10, 6, 10, 7), {
    signal: 'improving',
    previousAccuracy: 60,
    currentAccuracy: 70,
    deltaPercentagePoints: 10,
  });
});
