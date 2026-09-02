import assert from 'node:assert/strict';
import test from 'node:test';
import { estimatePlacementFromOfficialScores } from './ranking-estimator';

test('returns a rank interval when the simulated score ties official candidates', () => {
  const estimate = estimatePlacementFromOfficialScores(80, [95, 90, 80, 80, 75, 70]);

  assert.deepEqual(estimate, {
    lowerRank: 3,
    upperRank: 4,
    percentile: 66.67,
    sampleSize: 6,
    confidence: 'low',
    premise: 'Estimativa baseada exclusivamente na distribuição de notas oficiais importadas para o mesmo concurso, cargo e modalidade.',
  });
});

test('returns insertion rank when no official candidate has the same score', () => {
  const estimate = estimatePlacementFromOfficialScores(85, [95, 90, 80, 75]);

  assert.equal(estimate?.lowerRank, 3);
  assert.equal(estimate?.upperRank, 3);
  assert.equal(estimate?.percentile, 50);
});

test('ignores non-finite source values and refuses an unusable sample', () => {
  const estimate = estimatePlacementFromOfficialScores(80, [Number.NaN, 90, 70]);
  assert.equal(estimate?.sampleSize, 2);

  assert.equal(estimatePlacementFromOfficialScores(80, [Number.NaN]), null);
  assert.equal(estimatePlacementFromOfficialScores(Number.NaN, [80]), null);
});

test('raises confidence only with a meaningful official sample', () => {
  assert.equal(estimatePlacementFromOfficialScores(80, Array.from({ length: 29 }, () => 80))?.confidence, 'low');
  assert.equal(estimatePlacementFromOfficialScores(80, Array.from({ length: 30 }, () => 80))?.confidence, 'medium');
  assert.equal(estimatePlacementFromOfficialScores(80, Array.from({ length: 100 }, () => 80))?.confidence, 'high');
});
