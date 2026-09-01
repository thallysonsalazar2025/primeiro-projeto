export type PerformanceTrendSignal = 'insufficient' | 'improving' | 'stable' | 'declining';

export type PerformanceTrend = {
  signal: PerformanceTrendSignal;
  previousAccuracy: number | null;
  currentAccuracy: number | null;
  deltaPercentagePoints: number | null;
};

const MIN_ATTEMPTS_PER_WINDOW = 5;
const MEANINGFUL_DELTA_PERCENTAGE_POINTS = 5;

function accuracy(correct: number, attempts: number): number | null {
  if (attempts <= 0) return null;
  return Math.round((correct / attempts) * 1000) / 10;
}

export function classifyPerformanceTrend(
  previousAttempts: number,
  previousCorrect: number,
  currentAttempts: number,
  currentCorrect: number,
): PerformanceTrend {
  const previousAccuracy = accuracy(previousCorrect, previousAttempts);
  const currentAccuracy = accuracy(currentCorrect, currentAttempts);

  if (
    previousAttempts < MIN_ATTEMPTS_PER_WINDOW ||
    currentAttempts < MIN_ATTEMPTS_PER_WINDOW ||
    previousAccuracy === null ||
    currentAccuracy === null
  ) {
    return {
      signal: 'insufficient',
      previousAccuracy,
      currentAccuracy,
      deltaPercentagePoints: null,
    };
  }

  const deltaPercentagePoints = Math.round((currentAccuracy - previousAccuracy) * 10) / 10;
  const signal: PerformanceTrendSignal =
    deltaPercentagePoints >= MEANINGFUL_DELTA_PERCENTAGE_POINTS
      ? 'improving'
      : deltaPercentagePoints <= -MEANINGFUL_DELTA_PERCENTAGE_POINTS
        ? 'declining'
        : 'stable';

  return {
    signal,
    previousAccuracy,
    currentAccuracy,
    deltaPercentagePoints,
  };
}
