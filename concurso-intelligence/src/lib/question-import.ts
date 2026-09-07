import { validateExternalSourceHash, validateExternalSourceLicense } from './external-source-license.ts';
import { validatePublicHttpUrl } from './source-url-security.ts';

export const QUESTION_SOURCE_TYPES = [
  'OFFICIAL_PDF',
  'OFFICIAL_WEB',
  'OPEN_DATASET',
  'GITHUB_REPOSITORY',
  'MANUAL',
] as const;

export const IMPORTED_QUESTION_STATUSES = [
  'ACTIVE',
  'ANNULLED',
  'OUTDATED',
  'REVIEW_REQUIRED',
] as const;

export const MAX_QUESTION_IMPORT_BATCH_SIZE = 500;

export type QuestionSourceType = (typeof QUESTION_SOURCE_TYPES)[number];
export type ImportedQuestionStatus = (typeof IMPORTED_QUESTION_STATUSES)[number];

export type ImportedChoice = {
  label: string;
  text: string;
  isCorrect: boolean;
};

export type ImportedQuestion = {
  number?: number | null;
  statement: string;
  explanation?: string | null;
  status?: ImportedQuestionStatus;
  subject?: string | null;
  topic?: string | null;
  sourcePage?: number | null;
  sourceLabel?: string | null;
  choices: ImportedChoice[];
};

export type QuestionImportBatch = {
  source: {
    type: QuestionSourceType;
    url: string;
    license?: string | null;
    sourceHash?: string | null;
    notes?: string | null;
    retrievedAt?: string | null;
  };
  board: {
    acronym: string;
    name: string;
    website?: string | null;
  };
  exam: {
    title: string;
    year: number;
    sourceDocument?: string | null;
    sourceSha256?: string | null;
  };
  questions: ImportedQuestion[];
};

function requireRecord(value: unknown, field: string): asserts value is Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} deve ser um objeto`);
  }
}

function requireNonBlank(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} não pode ser vazio`);
}

function validateOptionalString(value: unknown, field: string): asserts value is string | null | undefined {
  if (value != null && typeof value !== 'string') {
    throw new Error(`${field} deve ser texto`);
  }
}

function validateOptionalSha256(value: unknown, field: string) {
  validateOptionalString(value, field);
  if (value == null || !value.trim()) return;
  if (!/^[a-fA-F0-9]{64}$/.test(value.trim())) {
    throw new Error(`${field} deve conter um SHA-256 hexadecimal de 64 caracteres`);
  }
}

function validateOptionalIsoDateTime(value: unknown, field: string) {
  validateOptionalString(value, field);
  if (value == null || !value.trim()) return;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(normalized) || Number.isNaN(Date.parse(normalized))) {
    throw new Error(`${field} deve estar em ISO-8601 UTC`);
  }
}

export function validateQuestionImportBatch(batch: QuestionImportBatch) {
  requireRecord(batch, 'batch');
  requireRecord(batch.source, 'source');
  requireRecord(batch.board, 'board');
  requireRecord(batch.exam, 'exam');
  if (!Array.isArray(batch.questions)) throw new Error('questions deve ser uma lista');

  requireNonBlank(batch.board.acronym, 'board.acronym');
  requireNonBlank(batch.board.name, 'board.name');
  requireNonBlank(batch.exam.title, 'exam.title');
  validateOptionalString(batch.board.website, 'board.website');
  validateOptionalString(batch.exam.sourceDocument, 'exam.sourceDocument');

  if (!Number.isInteger(batch.exam.year) || batch.exam.year < 1900 || batch.exam.year > 2200) {
    throw new Error('exam.year inválido');
  }
  validateOptionalSha256(batch.exam.sourceSha256, 'exam.sourceSha256');

  if (!QUESTION_SOURCE_TYPES.includes(batch.source.type)) {
    throw new Error(`source.type inválido: ${batch.source.type}`);
  }

  requireNonBlank(batch.source.url, 'source.url');
  validateOptionalString(batch.source.license, 'source.license');
  validateExternalSourceLicense(batch.source.type, batch.source.license);
  validateOptionalString(batch.source.notes, 'source.notes');
  validateOptionalIsoDateTime(batch.source.retrievedAt, 'source.retrievedAt');
  validatePublicHttpUrl(batch.source.url, 'source.url');
  validateOptionalSha256(batch.source.sourceHash, 'source.sourceHash');
  validateExternalSourceHash(batch.source.type, batch.source.sourceHash);
  if (batch.board.website?.trim()) {
    validatePublicHttpUrl(batch.board.website.trim(), 'board.website');
  }

  if (batch.questions.length === 0) throw new Error('questions deve conter ao menos uma questão');
  if (batch.questions.length > MAX_QUESTION_IMPORT_BATCH_SIZE) {
    throw new Error(`questions excede o limite de ${MAX_QUESTION_IMPORT_BATCH_SIZE} questões por lote`);
  }

  const seenQuestionNumbers = new Set<number>();
  for (const [index, question] of batch.questions.entries()) {
    const prefix = `questions[${index}]`;
    requireRecord(question, prefix);
    requireNonBlank(question.statement, `${prefix}.statement`);
    validateOptionalString(question.explanation, `${prefix}.explanation`);
    validateOptionalString(question.subject, `${prefix}.subject`);
    validateOptionalString(question.topic, `${prefix}.topic`);
    validateOptionalString(question.sourceLabel, `${prefix}.sourceLabel`);
    if (!Array.isArray(question.choices)) throw new Error(`${prefix}.choices deve ser uma lista`);
    if (question.number != null && (!Number.isInteger(question.number) || question.number <= 0)) {
      throw new Error(`${prefix}.number deve ser inteiro positivo`);
    }
    if (question.number != null) {
      if (seenQuestionNumbers.has(question.number)) {
        throw new Error(`${prefix}.number duplicado na prova: ${question.number}`);
      }
      seenQuestionNumbers.add(question.number);
    }
    if (question.sourcePage != null && (!Number.isInteger(question.sourcePage) || question.sourcePage <= 0)) {
      throw new Error(`${prefix}.sourcePage deve ser inteiro positivo`);
    }
    if (question.choices.length < 2) throw new Error(`${prefix}.choices deve conter ao menos duas alternativas`);

    const status = question.status ?? 'ACTIVE';
    if (!IMPORTED_QUESTION_STATUSES.includes(status)) {
      throw new Error(`${prefix}.status inválido: ${String(status)}`);
    }

    if (question.topic?.trim() && !question.subject?.trim()) {
      throw new Error(`${prefix}.topic requer subject`);
    }

    const labels = new Set<string>();
    for (const [choiceIndex, choice] of question.choices.entries()) {
      requireRecord(choice, `${prefix}.choices[${choiceIndex}]`);
      requireNonBlank(choice.label, `${prefix}.choices.label`);
      requireNonBlank(choice.text, `${prefix}.choices.text`);
      if (typeof choice.isCorrect !== 'boolean') {
        throw new Error(`${prefix}.choices[${choiceIndex}].isCorrect deve ser booleano`);
      }
      const normalizedLabel = choice.label.trim().toUpperCase();
      if (labels.has(normalizedLabel)) throw new Error(`${prefix}.choices contém label duplicado: ${choice.label}`);
      labels.add(normalizedLabel);
    }

    const correctCount = question.choices.filter((choice) => choice.isCorrect).length;
    if (status === 'ANNULLED') {
      if (correctCount !== 0) throw new Error(`${prefix} anulada não pode possuir alternativa correta`);
    } else if (correctCount !== 1) {
      throw new Error(`${prefix} deve possuir exatamente uma alternativa correta`);
    }
  }

  return batch;
}
