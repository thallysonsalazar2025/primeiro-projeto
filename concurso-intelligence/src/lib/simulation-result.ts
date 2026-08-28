export type SimulationAttemptForResult = {
  selected: string | null;
  correct: boolean;
  elapsedMs: number | null;
};

export type SimulationResult = {
  totalQuestions: number;
  answered: number;
  correct: number;
  incorrect: number;
  blank: number;
  accuracy: number;
  elapsedMs: number;
};

export function calculateSimulationResult(
  questionCount: number,
  attempts: SimulationAttemptForResult[],
): SimulationResult {
  const answeredAttempts = attempts.filter((attempt) => attempt.selected !== null);
  const answered = answeredAttempts.length;
  const correct = answeredAttempts.filter((attempt) => attempt.correct).length;
  const incorrect = answeredAttempts.filter((attempt) => !attempt.correct).length;
  const blank = Math.max(questionCount - answered, 0);
  const elapsedMs = attempts.reduce((total, attempt) => total + (attempt.elapsedMs ?? 0), 0);

  return {
    totalQuestions: questionCount,
    answered,
    correct,
    incorrect,
    blank,
    accuracy: answered === 0 ? 0 : correct / answered,
    elapsedMs,
  };
}
