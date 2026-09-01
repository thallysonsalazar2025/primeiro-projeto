import assert from 'node:assert/strict';
import test from 'node:test';

import {
  estimateForNewContest,
  estimateFromOfficialRanking,
  estimateFromOfficialRankingAggregate,
  type HistoricalContest,
} from './ranking.ts';

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

test('keeps an estimate below the minimum imported score inside its interval', () => {
  const result = estimateFromOfficialRanking(50, [
    { score: 90 },
    { score: 80 },
    { score: 70 },
  ]);

  assert.equal(result.estimatedRank, 4);
  assert.equal(result.percentile, 0);
  assert.equal(result.lowerRank, 3);
  assert.equal(result.upperRank, 4);
});

test('rejects an empty official distribution instead of fabricating a ranking', () => {
  assert.throws(() => estimateFromOfficialRanking(70, []), /Official ranking sample is empty/);
});

test('rejects invalid numbers in an official distribution', () => {
  assert.throws(() => estimateFromOfficialRanking(Number.NaN, [{ score: 80 }]), /Score must be a finite number/);
  assert.throws(() => estimateFromOfficialRanking(80, [{ score: Number.NaN }]), /Official ranking contains an invalid score/);
});

test('rejects impossible official ranking aggregate counts', () => {
  assert.throws(
    () => estimateFromOfficialRankingAggregate({ total: -1, higher: 0, equal: 0 }),
    /Official ranking total must be a non-negative safe integer/,
  );
  assert.throws(
    () => estimateFromOfficialRankingAggregate({ total: 10, higher: -1, equal: 0 }),
    /Official ranking higher count must be a non-negative safe integer/,
  );
  assert.throws(
    () => estimateFromOfficialRankingAggregate({ total: 10, higher: 2, equal: 1.5 }),
    /Official ranking equal count must be a non-negative safe integer/,
  );
  assert.throws(
    () => estimateFromOfficialRankingAggregate({ total: 10, higher: 11, equal: 0 }),
    /Official ranking aggregate is inconsistent/,
  );
  assert.throws(
    () => estimateFromOfficialRankingAggregate({ total: 10, higher: 8, equal: 3 }),
    /Official ranking aggregate is inconsistent/,
  );
});

test('weights distinct historical distributions by board, cargo and subject similarity', () => {
  const history: HistoricalContest[] = [
    {
      contestId: 'fgv-ti',
      board: 'FGV',
      cargoFamily: 'TI',
      subjectSimilarity: 1,
      rows: Array.from({ length: 100 }, (_, index) => ({ score: index + 1 })),
    },
    {
      contestId: 'cespe-ti',
      board: 'CESPE',
      cargoFamily: 'TI',
      subjectSimilarity: 0.8,
      rows: Array.from({ length: 60 }, (_, index) => ({ score: index + 41 })),
    },
    {
      contestId: 'fgv-admin',
      board: 'FGV',
      cargoFamily: 'ADMIN',
      subjectSimilarity: 0.5,
      rows: Array.from({ length: 40 }, (_, index) => ({ score: index + 61 })),
    },
  ];

  const result = estimateForNewContest(80, 1_000, 'FGV', 'TI', history);

  assert.equal(result.method, 'historical-board-model');
  assert.equal(result.sampleSize, 200);
  assert.equal(result.confidence, 'medium');
  assert.ok(Math.abs(result.percentile - 0.7105263157894738) < 1e-12);
  assert.equal(result.estimatedRank, 290);
  assert.equal(result.lowerRank, 150);
  assert.equal(result.upperRank, 430);
});

test('normalizes board names before applying historical weights', () => {
  const history: HistoricalContest[] = [
    {
      contestId: 'fgv-ti',
      board: 'FGV',
      cargoFamily: 'TI',
      subjectSimilarity: 1,
      rows: Array.from({ length: 20 }, (_, index) => ({ score: index + 70 })),
    },
    {
      contestId: 'cespe-ti',
      board: 'CESPE',
      cargoFamily: 'TI',
      subjectSimilarity: 1,
      rows: Array.from({ length: 20 }, (_, index) => ({ score: index + 50 })),
    },
  ];

  const normalized = estimateForNewContest(80, 500, 'FGV', 'TI', history);
  const padded = estimateForNewContest(80, 500, '  FGV  ', 'TI', history);
  assert.deepEqual(padded, normalized);
});

test('rejects future estimates without a minimally useful historical sample', () => {
  assert.throws(
    () => estimateForNewContest(75, 500, 'FGV', 'TI', [
      { contestId: 'tiny', board: 'FGV', cargoFamily: 'TI', subjectSimilarity: 1, rows: [{ score: 80 }] },
    ]),
    /Insufficient historical data/,
  );
});

test('rejects invalid future-estimator inputs instead of fabricating a position', () => {
  const history: HistoricalContest[] = [{
    contestId: 'fgv-ti',
    board: 'FGV',
    cargoFamily: 'TI',
    subjectSimilarity: 1,
    rows: Array.from({ length: 20 }, (_, index) => ({ score: index + 60 })),
  }];

  assert.throws(() => estimateForNewContest(101, 500, 'FGV', 'TI', history), /between 0 and 100/);
  assert.throws(() => estimateForNewContest(75, 0, 'FGV', 'TI', history), /positive integer/);
  assert.throws(() => estimateForNewContest(75, 500, '   ', 'TI', history), /Target board is required/);
});

test('rejects corrupted historical inputs before calculating confidence', () => {
  const baseRows = Array.from({ length: 20 }, (_, index) => ({ score: index + 60 }));

  assert.throws(
    () => estimateForNewContest(75, 500, 'FGV', 'TI', [{
      contestId: 'bad-score',
      board: 'FGV',
      cargoFamily: 'TI',
      subjectSimilarity: 1,
      rows: baseRows.map((row, index) => ({ score: index === 10 ? Number.NaN : row.score })),
    }]),
    /Historical ranking score must be between 0 and 100/,
  );

  assert.throws(
    () => estimateForNewContest(75, 500, 'FGV', 'TI', [{
      contestId: 'score-over-scale',
      board: 'FGV',
      cargoFamily: 'TI',
      subjectSimilarity: 1,
      rows: baseRows.map((row, index) => ({ score: index === 10 ? 101 : row.score })),
    }]),
    /Historical ranking score must be between 0 and 100/,
  );

  assert.throws(
    () => estimateForNewContest(75, 500, 'FGV', 'TI', [{
      contestId: 'bad-similarity',
      board: 'FGV',
      cargoFamily: 'TI',
      subjectSimilarity: 1.1,
      rows: baseRows,
    }]),
    /Historical subject similarity must be between 0 and 1/,
  );
});

test('normalizes extreme finite weights to avoid overflow', () => {
  const history: HistoricalContest[] = [
    {
      contestId: 'fgv-a',
      board: 'FGV',
      cargoFamily: 'TI',
      subjectSimilarity: 1,
      weight: Number.MAX_VALUE,
      rows: Array.from({ length: 20 }, (_, index) => ({ score: index + 60 })),
    },
    {
      contestId: 'fgv-b',
      board: 'FGV',
      cargoFamily: 'TI',
      subjectSimilarity: 1,
      weight: Number.MAX_VALUE,
      rows: Array.from({ length: 20 }, (_, index) => ({ score: index + 70 })),
    },
  ];

  const result = estimateForNewContest(75, 500, 'FGV', 'TI', history);
  assert.ok(Number.isFinite(result.percentile));
  assert.ok(Number.isFinite(result.estimatedRank));
  assert.ok(Number.isFinite(result.lowerRank));
  assert.ok(Number.isFinite(result.upperRank));
});
