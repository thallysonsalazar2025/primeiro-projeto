export type RankingEstimate = {
  lowerRank: number;
  upperRank: number;
  percentile: number;
  sampleSize: number;
  confidence: 'low' | 'medium' | 'high';
  premise: string;
};

function confidenceForSample(sampleSize: number): RankingEstimate['confidence'] {
  if (sampleSize >= 100) return 'high';
  if (sampleSize >= 30) return 'medium';
  return 'low';
}

export function estimatePlacementFromOfficialScores(
  simulatedScore: number,
  officialScores: number[],
): RankingEstimate | null {
  if (!Number.isFinite(simulatedScore) || officialScores.length === 0) return null;

  const scores = officialScores.filter(Number.isFinite);
  if (scores.length === 0) return null;

  const greater = scores.filter((score) => score > simulatedScore).length;
  const equal = scores.filter((score) => score === simulatedScore).length;
  const lowerRank = greater + 1;
  const upperRank = equal > 0 ? greater + equal : lowerRank;
  const percentile = Math.max(0, Math.min(100, ((scores.length - greater) / scores.length) * 100));

  return {
    lowerRank,
    upperRank,
    percentile: Number(percentile.toFixed(2)),
    sampleSize: scores.length,
    confidence: confidenceForSample(scores.length),
    premise: 'Estimativa baseada exclusivamente na distribuição de notas oficiais importadas para o mesmo concurso, cargo e modalidade.',
  };
}
