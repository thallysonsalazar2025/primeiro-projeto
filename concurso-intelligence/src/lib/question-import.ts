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

const SENSITIVE_SOURCE_QUERY_KEYS = new Set([
  'access_token',
  'apikey',
  'api_key',
  'auth',
  'authorization',
  'key',
  'password',
  'secret',
  'signature',
  'token',
]);

const SENSITIVE_SOURCE_QUERY_KEY_PARTS = new Set([
  'auth',
  'authorization',
  'key',
  'password',
  'secret',
  'signature',
  'token',
]);

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

function requireNonBlank(value: string, field: string) {
  if (!value.trim()) throw new Error(`${field} não pode ser vazio`);
}

function isSensitiveSourceQueryKey(key: string) {
  const normalized = key.toLowerCase();
  if (SENSITIVE_SOURCE_QUERY_KEYS.has(normalized)) return true;

  const parts = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  return parts.some((part) => SENSITIVE_SOURCE_QUERY_KEY_PARTS.has(part));
}

export function validateQuestionImportBatch(batch: QuestionImportBatch) {
  requireNonBlank(batch.board.acronym, 'board.acronym');
  requireNonBlank(batch.board.name, 'board.name');
  requireNonBlank(batch.exam.title, 'exam.title');

  if (!Number.isInteger(batch.exam.year) || batch.exam.year < 1900 || batch.exam.year > 2200) {
    throw new Error('exam.year inválido');
  }

  if (!QUESTION_SOURCE_TYPES.includes(batch.source.type)) {
    throw new Error(`source.type inválido: ${batch.source.type}`);
  }

  let parsedSource: URL;
  try {
    parsedSource = new URL(batch.source.url);
  } catch {
    throw new Error('source.url deve ser uma URL válida');
  }
  if (!['http:', 'https:'].includes(parsedSource.protocol)) {
    throw new Error('source.url deve usar http ou https');
  }
  if (parsedSource.username || parsedSource.password) {
    throw new Error('source.url não pode conter credenciais embutidas');
  }
  for (const key of parsedSource.searchParams.keys()) {
    if (isSensitiveSourceQueryKey(key)) {
      throw new Error(`source.url não pode conter parâmetro sensível: ${key}`);
    }
  }

  if (batch.questions.length === 0) throw new Error('questions deve conter ao menos uma questão');

  for (const [index, question] of batch.questions.entries()) {
    const prefix = `questions[${index}]`;
    requireNonBlank(question.statement, `${prefix}.statement`);
    if (question.number != null && (!Number.isInteger(question.number) || question.number <= 0)) {
      throw new Error(`${prefix}.number deve ser inteiro positivo`);
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
    for (const choice of question.choices) {
      requireNonBlank(choice.label, `${prefix}.choices.label`);
      requireNonBlank(choice.text, `${prefix}.choices.text`);
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
