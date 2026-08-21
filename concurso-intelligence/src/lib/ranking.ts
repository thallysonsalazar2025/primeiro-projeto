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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function percentileAgainstScores(score: number, rows: RankingRow[]) {
  if (!rows.length) return 0;
  const belowOrEqual = rows.filter((r) => r.score <= score).length;
  return belowOrEqual / rows.length;
}

export function estimateFromOfficialRanking(
  score: number,
  rows: RankingRow[],
): RankingEstimate {
  if (!rows.length) throw new Error('Official ranking sample is empty');

  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const higher = sorted.filter((row) => row.score > score).length;
  const equal = sorted.filter((row) => row.score === score).length;
  const estimatedRank = higher + Math.max(1, Math.ceil(equal / 2));
  const percentile = percentileAgainstScores(score, sorted);
  const uncertainty = Math.max(1, Math.ceil(equal / 2));

  return {
    estimatedRank,
    percentile,
    lowerRank: Math.max(1, estimatedRank - uncertainty),
    upperRank: Math.min(sorted.length, estimatedRank + uncertainty),
    confidence: sorted.length >= 200 ? 'high' : sorted.length >= 50 ? 'medium' : 'low',
    method: 'official-distribution',
    sampleSize: sorted.length,
  };
}

export function estimateForNewContest(
  simulatedScorePercent: number,
  expectedCandidates: number,
  targetBoard: string,
  targetCargoFamily: string | undefined,
  history: HistoricalContest[],
): RankingEstimate {
  const usable = history.filter((h) => h.rows.length >= 20);
  if (!usable.length) throw new Error('Insufficient historical data');

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
