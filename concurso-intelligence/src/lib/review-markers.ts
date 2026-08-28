export function nextReviewQuestionIds(
  currentIds: string[],
  questionId: string,
  markedForReview: boolean,
) {
  if (markedForReview) {
    return Array.from(new Set([...currentIds, questionId]));
  }

  return currentIds.filter((id) => id !== questionId);
}
