import assert from 'node:assert/strict';
import test from 'node:test';

import { estimateForNewContest, type HistoricalContest } from './ranking.ts';

function rows(start: number, length = 100) {
  return Array.from({ length }, (_, index) => ({ score: Math.min(100, start + index * 0.2) }));
}

test('does not report high confidence from a large but weakly comparable history', () => {
  const history: HistoricalContest[] = Array.from({ length: 5 }, (_, index) => ({
    contestId: `other-${index}`,
    board: 'CESPE',
    cargoFamily: 'ADMIN',
    subjectSimilarity: 0.9,
    difficultySimilarity: 0.9,
    vacancySimilarity: 0.9,
    rows: rows(50),
  }));

  const result = estimateForNewContest(75, 1_000, 'FGV', 'TI', history);

  assert.equal(result.sampleSize, 500);
  assert.equal(result.confidence, 'medium');
});

test('allows high confidence only with enough strongly comparable contests and sample', () => {
  const history: HistoricalContest[] = Array.from({ length: 5 }, (_, index) => ({
    contestId: `fgv-ti-${index}`,
    board: ' FGV ',
    cargoFamily: ' ti ',
    subjectSimilarity: 0.8,
    difficultySimilarity: 0.8,
    vacancySimilarity: 0.8,
    rows: rows(55),
  }));

  const result = estimateForNewContest(75, 1_000, 'FGV', 'TI', history);

  assert.equal(result.sampleSize, 500);
  assert.equal(result.confidence, 'high');
});

test('keeps medium confidence for three strongly comparable contests', () => {
  const history: HistoricalContest[] = Array.from({ length: 3 }, (_, index) => ({
    contestId: `fgv-ti-${index}`,
    board: 'FGV',
    cargoFamily: 'TI',
    subjectSimilarity: 0.7,
    rows: rows(55, 40),
  }));

  const result = estimateForNewContest(75, 1_000, 'FGV', 'TI', history);

  assert.equal(result.sampleSize, 120);
  assert.equal(result.confidence, 'medium');
});
