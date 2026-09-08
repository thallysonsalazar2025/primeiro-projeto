export type AnswerKeyPersistenceDecision = 'REUSE' | 'BACKFILL' | 'APPEND';

export type ExistingAnswerKeySnapshot = {
  kind: string;
  answer: string | null;
  isAnnulled: boolean;
  sourceUrl: string | null;
  publishedAt: Date | null;
};

export type IncomingFinalAnswerKey = {
  answer: string | null;
  isAnnulled: boolean;
  sourceUrl: string;
  publishedAt: Date | null;
  legacyQuestionSourceUrl: string;
};

function sameDate(left: Date | null, right: Date | null) {
  return left?.getTime() === right?.getTime() || (!left && !right);
}

export function decideFinalAnswerKeyPersistence(
  latest: ExistingAnswerKeySnapshot | null,
  incoming: IncomingFinalAnswerKey,
): AnswerKeyPersistenceDecision {
  if (
    !latest
    || latest.kind !== 'FINAL'
    || latest.answer !== incoming.answer
    || latest.isAnnulled !== incoming.isAnnulled
  ) {
    return 'APPEND';
  }

  if (latest.sourceUrl === incoming.sourceUrl && sameDate(latest.publishedAt, incoming.publishedAt)) {
    return 'REUSE';
  }

  if (latest.sourceUrl === incoming.legacyQuestionSourceUrl) {
    return 'BACKFILL';
  }

  return 'APPEND';
}
