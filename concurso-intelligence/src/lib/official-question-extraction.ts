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

function normalizedLabel(value: string) {
  return value.trim().toUpperCase();
}

export function normalizeOfficialQuestionExtraction(
  extraction: OfficialQuestionExtraction,
): QuestionImportBatch {
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
