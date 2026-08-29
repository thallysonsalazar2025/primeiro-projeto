export type AttemptHistoryInput = {
  id: string;
  selected: string | null;
  correct: boolean | null;
  answeredAt: Date;
  elapsedMs: number | null;
  confidence: number | null;
  question: {
    id: string;
    number: number | null;
    subject: { id: string; name: string } | null;
    topic: { id: string; name: string } | null;
  };
};

export function serializeAttemptHistory(attempts: AttemptHistoryInput[]) {
  return attempts.map((attempt, index) => ({
    id: attempt.id,
    sequence: index + 1,
    questionId: attempt.question.id,
    questionNumber: attempt.question.number,
    subject: attempt.question.subject,
    topic: attempt.question.topic,
    selected: attempt.selected,
    correct: attempt.correct,
    answeredAt: attempt.answeredAt,
    elapsedMs: attempt.elapsedMs,
    confidence: attempt.confidence,
  }));
}
