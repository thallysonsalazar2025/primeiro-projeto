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
  difficultySimilarity?: number; // 0..1
  vacancySimilarity?: number; // 0..1
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

function assertOfficialRankingCount(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function assertOptionalSimilarity(value: number | undefined, label: string) {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1`);
  }
}

function normalizeComparableText(value: string | undefined) {
  return value?.trim().toLowerCase() || undefined;
}

export function estimateFromOfficialRankingAggregate(
  aggregate: OfficialRankingAggregate,
): RankingEstimate {
  const { total, higher, equal } = aggregate;
  assertOfficialRankingCount(total, 'Official ranking total');
  assertOfficialRankingCount(higher, 'Official ranking higher count');
  assertOfficialRankingCount(equal, 'Official ranking equal count');
  if (total <= 0) throw new Error('Official ranking sample is empty');
  if (higher > total || equal > total - higher) {
    throw new Error('Official ranking aggregate is inconsistent');
  }

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

  const normalizedTargetBoard = normalizeComparableText(targetBoard);
  if (!normalizedTargetBoard) {
    throw new Error('Target board is required');
  }
  const normalizedTargetCargoFamily = normalizeComparableText(targetCargoFamily);

  const usable = history.filter((h) => h.rows.length >= 20);
  if (!usable.length) throw new Error('Insufficient historical data');

  for (const contest of usable) {
    if (!normalizeComparableText(contest.board)) throw new Error('Historical contest board is required');
    if (
      !Number.isFinite(contest.subjectSimilarity)
      || contest.subjectSimilarity < 0
      || contest.subjectSimilarity > 1
    ) {
      throw new Error('Historical subject similarity must be between 0 and 1');
    }
    assertOptionalSimilarity(contest.difficultySimilarity, 'Historical difficulty similarity');
    assertOptionalSimilarity(contest.vacancySimilarity, 'Historical vacancy similarity');
    if (contest.weight !== undefined && (!Number.isFinite(contest.weight) || contest.weight <= 0)) {
      throw new Error('Historical contest weight must be positive and finite');
    }
    if (contest.rows.some((row) => !Number.isFinite(row.score) || row.score < 0 || row.score > 100)) {
      throw new Error('Historical ranking score must be between 0 and 100');
    }
  }

  const weightedContests = usable.map((contest) => {
    const boardWeight = normalizeComparableText(contest.board) === normalizedTargetBoard ? 1 : 0.45;
    const cargoWeight = normalizedTargetCargoFamily
      && normalizeComparableText(contest.cargoFamily) === normalizedTargetCargoFamily ? 1 : 0.7;
    const similarityWeight = clamp(contest.subjectSimilarity, 0.2, 1);
    const difficultyWeight = clamp(contest.difficultySimilarity ?? 1, 0.2, 1);
    const vacancyWeight = clamp(contest.vacancySimilarity ?? 1, 0.2, 1);
    const rawWeight = (contest.weight ?? 1)
      * boardWeight
      * cargoWeight
      * similarityWeight
      * difficultyWeight
      * vacancyWeight;

    return {
      contest,
      percentile: percentileAgainstScores(simulatedScorePercent, contest.rows),
      rawWeight,
    };
  });

  const maxRawWeight = Math.max(...weightedContests.map(({ rawWeight }) => rawWeight));
  if (!Number.isFinite(maxRawWeight) || maxRawWeight <= 0) {
    throw new Error('Historical contest weights cannot produce a finite estimate');
  }

  let weightedPercentile = 0;
  let totalWeight = 0;
  let sampleSize = 0;

  for (const { contest, percentile, rawWeight } of weightedContests) {
    const normalizedWeight = rawWeight / maxRawWeight;
    weightedPercentile += percentile * normalizedWeight;
    totalWeight += normalizedWeight;
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
