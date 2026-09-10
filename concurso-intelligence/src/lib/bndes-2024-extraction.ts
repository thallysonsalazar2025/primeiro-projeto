import type {
  ExtractedOfficialQuestion,
  OfficialQuestionExtraction,
} from './official-question-extraction.ts';

export type Bndes2024TextPage = {
  page: number;
  text: string;
};

export type Bndes2024ExtractionMetadata = Pick<
  OfficialQuestionExtraction,
  'source' | 'answerKey' | 'board' | 'exam'
>;

const QUESTION_START = /^\s*(\d{1,3})\s*[.)-]\s+(.+)$/;
const CHOICE_START = /^\s*([A-E])\s*[).:-]\s+(.+)$/i;
const ANSWER_KEY_ENTRY = /(?:^|\s)(\d{1,3})\s*[-.:)]?\s*(ANULAD[AO]|[A-E])(?=\s|$)/giu;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function parseBndes2024AnswerKey(text: string) {
  const answers = new Map<number, string | null>();

  for (const match of text.matchAll(ANSWER_KEY_ENTRY)) {
    const number = Number(match[1]);
    const rawAnswer = match[2]!.toUpperCase();
    const answer = rawAnswer.startsWith('ANULAD') ? null : rawAnswer;

    if (answers.has(number)) {
      throw new Error(`BNDES 2024: questão ${number} duplicada no gabarito.`);
    }
    answers.set(number, answer);
  }

  if (answers.size === 0) {
    throw new Error('BNDES 2024: nenhum item reconhecido no gabarito final.');
  }

  return answers;
}

export function parseBndes2024ExamPages(pages: Bndes2024TextPage[]) {
  const questions: ExtractedOfficialQuestion[] = [];
  let current: ExtractedOfficialQuestion | null = null;
  let currentChoice: { label: string; text: string } | null = null;

  const flushChoice = () => {
    if (!current || !currentChoice) return;
    current.choices.push({
      label: currentChoice.label,
      text: normalizeWhitespace(currentChoice.text),
    });
    currentChoice = null;
  };

  const flushQuestion = () => {
    if (!current) return;
    flushChoice();
    current.statement = normalizeWhitespace(current.statement);
    if (!current.statement || current.choices.length < 2) {
      throw new Error(`BNDES 2024: questão ${current.number ?? '?'} incompleta no caderno.`);
    }
    questions.push(current);
    current = null;
  };

  for (const page of pages) {
    if (!Number.isInteger(page.page) || page.page <= 0) {
      throw new Error('BNDES 2024: página de origem inválida.');
    }

    for (const rawLine of page.text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;

      const questionMatch = QUESTION_START.exec(line);
      if (questionMatch) {
        flushQuestion();
        current = {
          number: Number(questionMatch[1]),
          statement: questionMatch[2]!,
          choices: [],
          sourcePage: page.page,
          sourceLabel: `BNDES 2024 p.${page.page}`,
        };
        continue;
      }

      if (!current) continue;

      const choiceMatch = CHOICE_START.exec(line);
      if (choiceMatch) {
        flushChoice();
        currentChoice = {
          label: choiceMatch[1]!.toUpperCase(),
          text: choiceMatch[2]!,
        };
        continue;
      }

      if (currentChoice) currentChoice.text += ` ${line}`;
      else current.statement += ` ${line}`;
    }
  }

  flushQuestion();

  if (questions.length === 0) {
    throw new Error('BNDES 2024: nenhuma questão reconhecida no caderno.');
  }

  const seen = new Set<number>();
  for (const question of questions) {
    const number = question.number!;
    if (seen.has(number)) throw new Error(`BNDES 2024: questão ${number} duplicada no caderno.`);
    seen.add(number);
  }

  return questions;
}

export function buildBndes2024OfficialExtraction(
  pages: Bndes2024TextPage[],
  answerKeyText: string,
  metadata: Bndes2024ExtractionMetadata,
): OfficialQuestionExtraction {
  const questions = parseBndes2024ExamPages(pages);
  const answers = parseBndes2024AnswerKey(answerKeyText);

  for (const question of questions) {
    const number = question.number!;
    if (!answers.has(number)) {
      throw new Error(`BNDES 2024: questão ${number} não encontrada no gabarito final.`);
    }

    const correctLabel = answers.get(number) ?? null;
    question.correctLabel = correctLabel;
    question.status = correctLabel == null ? 'ANNULLED' : 'ACTIVE';
  }

  const unknownAnswers = [...answers.keys()].filter(
    (number) => !questions.some((question) => question.number === number),
  );
  if (unknownAnswers.length > 0) {
    throw new Error(
      `BNDES 2024: gabarito contém questões ausentes no caderno: ${unknownAnswers.join(', ')}.`,
    );
  }

  return {
    ...metadata,
    questions,
  };
}
