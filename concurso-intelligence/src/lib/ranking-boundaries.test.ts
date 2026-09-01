import assert from 'node:assert/strict';
import test from 'node:test';

import { estimateForNewContest, type HistoricalContest } from './ranking.ts';

test('keeps the worst possible future estimate inside the candidate population', () => {
  const history: HistoricalContest[] = [
    {
      contestId: 'historical-a',
      board: 'FGV',
      cargoFamily: 'TI',
      subjectSimilarity: 1,
      rows: Array.from({ length: 20 }, (_, index) => ({ score: index + 60 })),
    },
  ];

  const result = estimateForNewContest(0, 500, 'FGV', 'TI', history);

  assert.equal(result.percentile, 0);
  assert.equal(result.estimatedRank, 500);
  assert.ok(result.lowerRank >= 1);
  assert.equal(result.upperRank, 500);
  assert.ok(result.lowerRank <= result.estimatedRank);
  assert.ok(result.estimatedRank <= result.upperRank);
});
