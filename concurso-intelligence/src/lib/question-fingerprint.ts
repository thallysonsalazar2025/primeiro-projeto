import { createHash } from 'node:crypto';

export type QuestionFingerprintInput = {
  board: string;
  year: number;
  examTitle: string;
  number?: number | null;
  statement: string;
  choices: Array<{ label: string; text: string }>;
};

function normalize(value: string) {
  return value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

export function questionFingerprint(input: QuestionFingerprintInput) {
  const normalizedChoices = [...input.choices]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((choice) => `${choice.label}:${normalize(choice.text)}`)
    .join('|');

  const canonical = [
    normalize(input.board),
    String(input.year),
    normalize(input.examTitle),
    String(input.number ?? ''),
    normalize(input.statement),
    normalizedChoices,
  ].join('::');

  return createHash('sha256').update(canonical).digest('hex');
}
