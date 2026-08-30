import assert from 'node:assert/strict';
import test from 'node:test';

import { estimateForNewContest, estimateFromOfficialRanking, type HistoricalContest } from './ranking.ts';

test('estimates rank and percentile from an official distribution with ties', () => {
  const result = estimateFromOfficialRanking(90, [
    { score: 100 },
    { score: 90 },
    { score: 90 },
    { score: 80 },
  ]);

  assert.deepEqual(result, {
    estimatedRank: 2,
    percentile: 0.75,
    lowerRank: 1,
    upperRank: 3,
    confidence: 'low',
    method: 'official-distribution',
    sampleSize: 4,
  });
});

test('rejects an empty official distribution instead of fabricating a ranking', () => {
  assert.throws(() => estimateFromOfficialRanking(70, []), /Official ranking sample is empty/);
});

test('estimates a future contest as a range and reports model confidence', () => {
  const rows = Array.from({ length: 100 }, (_, index) => ({ score: index + 1 }));
  const history: HistoricalContest[] = [
    { contestId: 'fgv-1', board: 'FGV', cargoFamily: 'TI', subjectSimilarity: 1, rows },
    { contestId: 'fgv-2', board: 'FGV', cargoFamily: 'TI', subjectSimilarity: 0.9, rows },
    { contestId: 'fgv-3', board: 'FGV', cargoFamily: 'TI', subjectSimilarity: 0.8, rows },
  ];

  const result = estimateForNewContest(80, 1_000, 'FGV', 'TI', history);

  assert.equal(result.method, 'historical-board-model');
  assert.equal(result.sampleSize, 300);
  assert.equal(result.confidence, 'medium');
  assert.ok(result.percentile > 0 && result.percentile <= 1);
  assert.ok(result.lowerRank <= result.estimatedRank);
  assert.ok(result.upperRank >= result.estimatedRank);
  assert.ok(result.lowerRank >= 1);
  assert.ok(result.upperRank <= 1_000);
});

test('rejects future estimates without a minimally useful historical sample', () => {
  assert.throws(
    () => estimateForNewContest(75, 500, 'FGV', 'TI', [
      { contestId: 'tiny', board: 'FGV', cargoFamily: 'TI', subjectSimilarity: 1, rows: [{ score: 80 }] },
    ]),
    /Insufficient historical data/,
  );
});
