type QuestionSourceMetadataInput = {
  sourcePage?: number | null;
  sourceLabel?: string | null;
};

export function questionSourceMetadataUpdate(question: QuestionSourceMetadataInput) {
  const hasSourcePage = Object.prototype.hasOwnProperty.call(question, 'sourcePage');
  const hasSourceLabel = Object.prototype.hasOwnProperty.call(question, 'sourceLabel');

  return {
    ...(hasSourcePage ? { sourcePage: question.sourcePage ?? null } : {}),
    ...(hasSourceLabel ? { sourceLabel: question.sourceLabel?.trim() || null } : {}),
  };
}
