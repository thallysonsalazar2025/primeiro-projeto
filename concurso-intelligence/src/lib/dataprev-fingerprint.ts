import { createHash } from 'node:crypto';

export type DataprevLegacyQuestion = {
  n: number;
  stem: string;
  options: [string, string][];
};

export function dataprevFingerprint(question: DataprevLegacyQuestion) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        n: question.n,
        stem: question.stem.trim(),
        options: question.options,
      }),
    )
    .digest('hex');
}
