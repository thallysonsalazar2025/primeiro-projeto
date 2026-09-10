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
  'source' | 'board' | 'exam'
> & {
  answerKey: NonNullable<OfficialQuestionExtraction['answerKey']>;
};

const QUESTION_START = /^\s*(\d{1,3})\s*[.)-]\s+(.+)$/;
const STANDALONE_QUESTION = /^\s*(\d{1,3})\s*$/;
const CHOICE_START = /^\s*(?:\(([A-E])\)|([A-E])\s*[).:-])\s+(.+)$/i;
const ANSWER_KEY_ENTRY = /(?:^|\s)(\d{1,3})\s*[-.:)]?\s*(ANULAD[AO]|[A-E])(?=\s|$)/giu;
const DEVELOPMENT_SECTION = /AN[ÁA]LISE\s+DE\s+SISTEMAS\s*[-–—:]?\s*DESENVOLVIMENTO/iu;
const NEXT_PROFILE_SECTION = /^\s*(?:AN[ÁA]LISE\s+DE\s+SISTEMAS\s*[-–—:]\s*(?!DESENVOLVIMENTO)|ÊNFASE\s*:|PERFIL\s*:|CARGO\s*:)/iu;
const EXPECTED_LABELS = ['A', 'B', 'C', 'D', 'E'] as const;

function normalizePdfLine(value: string) {
  return value.replace(/[\t\u00a0 ]+/g, ' ').trim();
}

function appendStructuredText(current: string, next: string) {
  const normalized = normalizePdfLine(next);
  if (!normalized) return current;
  return current ? `${current}\n${normalized}` : normalized;
}

function isPageFurniture(line: string) {
  const normalized = normalizePdfLine(line);
  return (
    /^P[ÁA]GINA\s+\d+\s*$/iu.test(normalized)
    || /^BNDES\s+2024$/iu.test(normalized)
    || /^CONCURSO\s+P[ÚU]BLICO/iu.test(normalized)
    || /^FUNDA[ÇC][ÃA]O\s+CESGRANRIO/iu.test(normalized)
    || /^AN[ÁA]LISE\s+DE\s+SISTEMAS\s*[-–—:]?\s*DESENVOLVIMENTO$/iu.test(normalized)
  );
}

function isolateDevelopmentAnswerKey(text: string) {
  const match = DEVELOPMENT_SECTION.exec(text);
  if (!match || match.index == null) {
    throw new Error('BNDES 2024: seção de Análise de Sistemas - Desenvolvimento não encontrada no gabarito final.');
  }

  const tail = text.slice(match.index + match[0].length);
  const lines = tail.split(/\r?\n/);
  const scoped: string[] = [];

  for (const line of lines) {
    if (NEXT_PROFILE_SECTION.test(line)) break;
    scoped.push(line);
  }

  const result = scoped.join('\n').trim();
  if (!result) {
    throw new Error('BNDES 2024: seção de Desenvolvimento vazia no gabarito final.');
  }
  return result;
}

export function parseBndes2024AnswerKey(text: string) {
  const scopedText = isolateDevelopmentAnswerKey(text);
  const answers = new Map<number, string | null>();

  for (const match of scopedText.matchAll(ANSWER_KEY_ENTRY)) {
    const number = Number(match[1]);
    const rawAnswer = match[2]!.toUpperCase();
    const answer = rawAnswer.startsWith('ANULAD') ? null : rawAnswer;

    if (answers.has(number)) {
      throw new Error(`BNDES 2024: questão ${number} duplicada no gabarito da seção Desenvolvimento.`);
    }
    answers.set(number, answer);
  }

  if (answers.size === 0) {
    throw new Error('BNDES 2024: nenhum item reconhecido no gabarito final da seção Desenvolvimento.');
  }

  return answers;
}

export function parseBndes2024ExamPages(pages: Bndes2024TextPage[]) {
  const questions: ExtractedOfficialQuestion[] = [];
  let current: ExtractedOfficialQuestion | null = null;
  let currentChoice: { label: string; text: string } | null = null;
  let pendingQuestionNumber: number | null = null;

  const flushChoice = () => {
    if (!current || !currentChoice) return;
    current.choices.push({
      label: currentChoice.label,
      text: currentChoice.text.trim(),
    });
    currentChoice = null;
  };

  const flushQuestion = () => {
    if (!current) return;
    flushChoice();
    current.statement = current.statement.trim();
    const labels = current.choices.map((choice) => choice.label.toUpperCase());
    const uniqueLabels = new Set(labels);
    const hasEveryExpectedLabel = EXPECTED_LABELS.every((label) => uniqueLabels.has(label));
    if (!current.statement || labels.length !== EXPECTED_LABELS.length || uniqueLabels.size !== EXPECTED_LABELS.length || !hasEveryExpectedLabel) {
      throw new Error(`BNDES 2024: questão ${current.number ?? '?'} incompleta; são obrigatórias exatamente as alternativas A-E.`);
    }
    questions.push(current);
    current = null;
  };

  const openQuestion = (number: number, statement: string, page: number) => {
    flushQuestion();
    current = {
      number,
      statement: normalizePdfLine(statement),
      choices: [],
      sourcePage: page,
      sourceLabel: `BNDES 2024 p.${page}`,
    };
  };

  for (const page of pages) {
    if (!Number.isInteger(page.page) || page.page <= 0) {
      throw new Error('BNDES 2024: página de origem inválida.');
    }

    for (const rawLine of page.text.split(/\r?\n/)) {
      const line = normalizePdfLine(rawLine);
      if (!line || isPageFurniture(line)) continue;

      const questionMatch = QUESTION_START.exec(line);
      if (questionMatch) {
        pendingQuestionNumber = null;
        openQuestion(Number(questionMatch[1]), questionMatch[2]!, page.page);
        continue;
      }

      const standaloneQuestionMatch = STANDALONE_QUESTION.exec(line);
      if (standaloneQuestionMatch) {
        flushQuestion();
        pendingQuestionNumber = Number(standaloneQuestionMatch[1]);
        continue;
      }

      if (pendingQuestionNumber != null) {
        openQuestion(pendingQuestionNumber, line, page.page);
        pendingQuestionNumber = null;
        continue;
      }

      const activeQuestion = current as ExtractedOfficialQuestion | null;
      if (!activeQuestion) continue;

      const choiceMatch = CHOICE_START.exec(line);
      if (choiceMatch) {
        flushChoice();
        currentChoice = {
          label: (choiceMatch[1] ?? choiceMatch[2])!.toUpperCase(),
          text: normalizePdfLine(choiceMatch[3]!),
        };
        continue;
      }

      if (currentChoice) currentChoice.text = appendStructuredText(currentChoice.text, line);
      else activeQuestion.statement = appendStructuredText(activeQuestion.statement, line);
    }
  }

  if (pendingQuestionNumber != null) {
    throw new Error(`BNDES 2024: questão ${pendingQuestionNumber} sem enunciado após marcador isolado.`);
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
  if (!metadata.answerKey?.url?.trim()) {
    throw new Error('BNDES 2024: URL do gabarito final é obrigatória para preservar proveniência.');
  }

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

  const questionNumbers = new Set(questions.map((question) => question.number!));
  const unknownAnswers = [...answers.keys()].filter((number) => !questionNumbers.has(number));
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
