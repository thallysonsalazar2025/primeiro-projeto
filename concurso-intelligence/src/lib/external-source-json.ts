import {
  assertNoDuplicateRankingRows,
  parseOfficialRankingImport,
  type OfficialRankingImport,
} from './official-ranking-import.ts';
import { validateQuestionImportBatch, type QuestionImportBatch } from './question-import.ts';

export type JsonEnqueueKind = 'questions' | 'rankings';

function normalizedContentType(contentType: string | null | undefined) {
  return contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

function hasUtf8Bom(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
}

export function assertJsonEnqueuePayload(
  bytes: Uint8Array,
  contentType: string | null | undefined,
  kind: 'questions',
): QuestionImportBatch;
export function assertJsonEnqueuePayload(
  bytes: Uint8Array,
  contentType: string | null | undefined,
  kind: 'rankings',
): OfficialRankingImport;
export function assertJsonEnqueuePayload(
  bytes: Uint8Array,
  contentType: string | null | undefined,
): unknown;
export function assertJsonEnqueuePayload(
  bytes: Uint8Array,
  contentType: string | null | undefined,
  kind?: JsonEnqueueKind,
) {
  const mediaType = normalizedContentType(contentType);
  if (mediaType && mediaType !== 'application/json' && !mediaType.endsWith('+json')) {
    throw new Error(`Fonte para enqueue deve retornar JSON; Content-Type recebido: ${mediaType}.`);
  }

  if (hasUtf8Bom(bytes)) {
    throw new Error('Fonte para enqueue deve conter JSON UTF-8 sem BOM.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('Fonte para enqueue deve conter JSON UTF-8 válido.');
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('Fonte para enqueue deve conter um objeto ou array JSON.');
  }

  if (kind === 'questions') {
    return validateQuestionImportBatch(parsed as QuestionImportBatch);
  }
  if (kind === 'rankings') {
    const ranking = parseOfficialRankingImport(parsed);
    assertNoDuplicateRankingRows(ranking);
    return ranking;
  }

  return parsed;
}
