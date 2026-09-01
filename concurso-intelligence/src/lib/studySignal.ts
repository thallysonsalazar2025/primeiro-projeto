export type StudySignal = 'insufficient' | 'weak' | 'stable' | 'strong';

const MIN_ATTEMPTS_FOR_SIGNAL = 5;

export function classifyStudySignal(attempts: number, accuracy: number): StudySignal {
  if (attempts < MIN_ATTEMPTS_FOR_SIGNAL) return 'insufficient';
  if (accuracy < 60) return 'weak';
  if (accuracy >= 80) return 'strong';
  return 'stable';
}
