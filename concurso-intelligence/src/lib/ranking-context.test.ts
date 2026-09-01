import assert from 'node:assert/strict';
import test from 'node:test';

import { estimateForNewContest, type HistoricalContest } from './ranking.ts';

const lowerScores = Array.from({ length: 20 }, (_, index) => ({ score: index + 60 }));
const higherScores = Array.from({ length: 20 }, (_, index) => ({ score: index + 80 }));

test('weights historical contests by difficulty and vacancy similarity when available', () => {
  const contextualHistory: HistoricalContest[] = [
    {
      contestId: 'matched-context',
      board: 'FGV',
      cargoFamily: 'TI',
      subjectSimilarity: 1,
      difficultySimilarity: 1,
      vacancySimilarity: 1,
      rows: lowerScores,
    },
    {
      contestId: 'different-context',
      board: 'FGV',
      cargoFamily: 'TI',
      subjectSimilarity: 1,
      difficultySimilarity: 0,
      vacancySimilarity: 0,
      rows: higherScores,
    },
  ];

  const neutralHistory = contextualHistory.map(({ difficultySimilarity, vacancySimilarity, ...contest }) => contest);
  const contextual = estimateForNewContest(80, 500, 'FGV', 'TI', contextualHistory);
  const neutral = estimateForNewContest(80, 500, 'FGV', 'TI', neutralHistory);

  assert.ok(contextual.percentile > neutral.percentile);
  assert.ok(contextual.estimatedRank < neutral.estimatedRank);
});

test('rejects invalid difficulty and vacancy similarities', () => {
  assert.throws(
    () => estimateForNewContest(80, 500, 'FGV', 'TI', [{
      contestId: 'bad-difficulty',
      board: 'FGV',
      cargoFamily: 'TI',
      subjectSimilarity: 1,
      difficultySimilarity: 1.1,
      rows: lowerScores,
    }]),
    /Historical difficulty similarity must be between 0 and 1/,
  );

  assert.throws(
    () => estimateForNewContest(80, 500, 'FGV', 'TI', [{
      contestId: 'bad-vacancies',
      board: 'FGV',
      cargoFamily: 'TI',
      subjectSimilarity: 1,
      vacancySimilarity: Number.NaN,
      rows: lowerScores,
    }]),
    /Historical vacancy similarity must be between 0 and 1/,
  );
});
