import {
  validateQuestionImportBatch,
  type ImportedQuestionStatus,
  type QuestionImportBatch,
} from './question-import.ts';

export type ExtractedOfficialChoice = {
  label: string;
  text: string;
};

export type ExtractedOfficialQuestion = {
  number?: number | null;
  statement: string;
  choices: ExtractedOfficialChoice[];
  correctLabel?: string | null;
  status?: ImportedQuestionStatus;
  subject?: string | null;
  topic?: string | null;
  explanation?: string | null;
  sourcePage?: number | null;
  sourceLabel?: string | null;
};

export type OfficialQuestionExtraction = {
  source: QuestionImportBatch['source'];
  board: QuestionImportBatch['board'];
  exam: QuestionImportBatch['exam'];
  questions: ExtractedOfficialQuestion[];
};

const OFFICIAL_SOURCE_TYPES = new Set(['OFFICIAL_PDF', 'OFFICIAL_WEB']);

function normalizedLabel(value: string) {
  return value.trim().toUpperCase();
}

function requireRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} deve ser um objeto`);
  }
}

function requireString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') throw new Error(`${field} deve ser texto`);
}

function validateOptionalString(value: unknown, field: string): asserts value is string | null | undefined {
  if (value != null && typeof value !== 'string') throw new Error(`${field} deve ser texto`);
}

function parseOfficialQuestionExtraction(input: unknown): OfficialQuestionExtraction {
  requireRecord(input, 'extraction');
  requireRecord(input.source, 'source');
  requireRecord(input.board, 'board');
  requireRecord(input.exam, 'exam');
  if (!Array.isArray(input.questions)) throw new Error('questions deve ser uma lista');

  for (const [index, question] of input.questions.entries()) {
    const prefix = `questions[${index}]`;
    requireRecord(question, prefix);
    requireString(question.statement, `${prefix}.statement`);
    validateOptionalString(question.correctLabel, `${prefix}.correctLabel`);
    validateOptionalString(question.subject, `${prefix}.subject`);
    validateOptionalString(question.topic, `${prefix}.topic`);
    validateOptionalString(question.explanation, `${prefix}.explanation`);
    validateOptionalString(question.sourceLabel, `${prefix}.sourceLabel`);
    if (!Array.isArray(question.choices)) throw new Error(`${prefix}.choices deve ser uma lista`);

    for (const [choiceIndex, choice] of question.choices.entries()) {
      requireRecord(choice, `${prefix}.choices[${choiceIndex}]`);
      requireString(choice.label, `${prefix}.choices[${choiceIndex}].label`);
      requireString(choice.text, `${prefix}.choices[${choiceIndex}].text`);
    }
  }

  return input as OfficialQuestionExtraction;
}

export function normalizeOfficialQuestionExtraction(
  input: unknown,
): QuestionImportBatch {
  const extraction = parseOfficialQuestionExtraction(input);

  if (!OFFICIAL_SOURCE_TYPES.has(extraction.source.type)) {
    throw new Error(`source.type deve ser uma fonte oficial: ${extraction.source.type}`);
  }

  const batch: QuestionImportBatch = {
    source: extraction.source,
    board: extraction.board,
    exam: extraction.exam,
    questions: extraction.questions.map((question, index) => {
      const status = question.status ?? 'ACTIVE';
      const correctLabel = question.correctLabel?.trim()
        ? normalizedLabel(question.correctLabel)
        : null;

      if (status !== 'ANNULLED' && !correctLabel) {
        throw new Error(`questions[${index}].correctLabel é obrigatório para questão não anulada`);
      }

      if (status === 'ANNULLED' && correctLabel) {
        throw new Error(`questions[${index}] anulada não pode possuir correctLabel`);
      }

      const normalizedChoices = question.choices.map((choice) => ({
        label: normalizedLabel(choice.label),
        text: choice.text.trim(),
        isCorrect: status === 'ANNULLED' ? false : normalizedLabel(choice.label) === correctLabel,
      }));

      if (correctLabel && !normalizedChoices.some((choice) => choice.label === correctLabel)) {
        throw new Error(`questions[${index}].correctLabel não corresponde a nenhuma alternativa`);
      }

      return {
        number: question.number,
        statement: question.statement.trim(),
        explanation: question.explanation?.trim() || null,
        status,
        subject: question.subject?.trim() || null,
        topic: question.topic?.trim() || null,
        sourcePage: question.sourcePage,
        sourceLabel: question.sourceLabel?.trim() || null,
        choices: normalizedChoices,
      };
    }),
  };

  return validateQuestionImportBatch(batch);
}
