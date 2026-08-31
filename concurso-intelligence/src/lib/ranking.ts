export type RankingRow = {
  score: number;
  rank?: number | null;
  category?: string;
};

export type HistoricalContest = {
  contestId: string;
  board: string;
  cargoFamily?: string;
  subjectSimilarity: number; // 0..1
  rows: RankingRow[];
  weight?: number;
};

export type RankingEstimate = {
  estimatedRank: number;
  percentile: number;
  lowerRank: number;
  upperRank: number;
  confidence: 'high' | 'medium' | 'low';
  method: 'official-distribution' | 'historical-board-model';
  sampleSize: number;
};

export type OfficialRankingAggregate = {
  total: number;
  higher: number;
  equal: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function percentileAgainstScores(score: number, rows: RankingRow[]) {
  if (!rows.length) return 0;
  const belowOrEqual = rows.filter((r) => r.score <= score).length;
  return belowOrEqual / rows.length;
}

function assertFiniteScore(score: number, label: string) {
  if (!Number.isFinite(score)) {
    throw new Error(`${label} must be a finite number`);
  }
}

export function estimateFromOfficialRankingAggregate(
  aggregate: OfficialRankingAggregate,
): RankingEstimate {
  const { total, higher, equal } = aggregate;
  if (total <= 0) throw new Error('Official ranking sample is empty');

  const estimatedRank = higher + Math.max(1, Math.ceil(equal / 2));
  const percentile = (total - higher) / total;
  const uncertainty = Math.max(1, Math.ceil(equal / 2));
  const lowerRank = Math.max(1, estimatedRank - uncertainty);
  const upperRank = Math.max(estimatedRank, Math.min(total, estimatedRank + uncertainty));

  return {
    estimatedRank,
    percentile,
    lowerRank,
    upperRank,
    confidence: total >= 200 ? 'high' : total >= 50 ? 'medium' : 'low',
    method: 'official-distribution',
    sampleSize: total,
  };
}

export function estimateFromOfficialRanking(
  score: number,
  rows: RankingRow[],
): RankingEstimate {
  assertFiniteScore(score, 'Score');
  if (!rows.length) throw new Error('Official ranking sample is empty');
  if (rows.some((row) => !Number.isFinite(row.score))) {
    throw new Error('Official ranking contains an invalid score');
  }

  const higher = rows.filter((row) => row.score > score).length;
  const equal = rows.filter((row) => row.score === score).length;
  return estimateFromOfficialRankingAggregate({ total: rows.length, higher, equal });
}

export function estimateForNewContest(
  simulatedScorePercent: number,
  expectedCandidates: number,
  targetBoard: string,
  targetCargoFamily: string | undefined,
  history: HistoricalContest[],
): RankingEstimate {
  assertFiniteScore(simulatedScorePercent, 'Simulated score');
  if (simulatedScorePercent < 0 || simulatedScorePercent > 100) {
    throw new Error('Simulated score must be between 0 and 100');
  }
  if (!Number.isInteger(expectedCandidates) || expectedCandidates <= 0) {
    throw new Error('Expected candidates must be a positive integer');
  }
  if (!targetBoard.trim()) {
    throw new Error('Target board is required');
  }

  const usable = history.filter((h) => h.rows.length >= 20);
  if (!usable.length) throw new Error('Insufficient historical data');

  for (const contest of usable) {
    if (!contest.board.trim()) throw new Error('Historical contest board is required');
    if (!Number.isFinite(contest.subjectSimilarity)) {
      throw new Error('Historical subject similarity must be finite');
    }
    if (contest.weight !== undefined && (!Number.isFinite(contest.weight) || contest.weight <= 0)) {
      throw new Error('Historical contest weight must be positive and finite');
    }
    if (contest.rows.some((row) => !Number.isFinite(row.score))) {
      throw new Error('Historical ranking contains an invalid score');
    }
  }

  let weightedPercentile = 0;
  let totalWeight = 0;
  let sampleSize = 0;

  for (const contest of usable) {
    const boardWeight = contest.board.toLowerCase() === targetBoard.toLowerCase() ? 1 : 0.45;
    const cargoWeight = targetCargoFamily && contest.cargoFamily === targetCargoFamily ? 1 : 0.7;
    const similarityWeight = clamp(contest.subjectSimilarity, 0.2, 1);
    const weight = (contest.weight ?? 1) * boardWeight * cargoWeight * similarityWeight;
    const percentile = percentileAgainstScores(simulatedScorePercent, contest.rows);

    weightedPercentile += percentile * weight;
    totalWeight += weight;
    sampleSize += contest.rows.length;
  }

  const percentile = totalWeight ? weightedPercentile / totalWeight : 0;
  const estimatedRank = Math.max(1, Math.round((1 - percentile) * expectedCandidates) + 1);

  const effectiveHistory = usable.length;
  const uncertaintyRate = effectiveHistory >= 5 ? 0.08 : effectiveHistory >= 3 ? 0.14 : 0.22;
  const margin = Math.max(3, Math.round(expectedCandidates * uncertaintyRate));

  return {
    estimatedRank,
    percentile,
    lowerRank: Math.max(1, estimatedRank - margin),
    upperRank: Math.min(expectedCandidates, estimatedRank + margin),
    confidence: effectiveHistory >= 5 && sampleSize >= 500 ? 'high' : effectiveHistory >= 3 ? 'medium' : 'low',
    method: 'historical-board-model',
    sampleSize,
  };
}
