import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BNDES_2024_SOURCE_URL } from './bndes-2024-source.ts';
import {
  buildBndes2024ExtractionFromSnapshot,
  buildBndes2024ImportBatchFromSnapshot,
} from './bndes-2024-pipeline.ts';

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function createSnapshot() {
  const dir = await mkdtemp(path.join(tmpdir(), 'bndes-pipeline-'));
  const exam = Buffer.from('%PDF-exam-fixture');
  const answerKey = Buffer.from('%PDF-answer-key-fixture');
  const retrievedAt = '2026-09-10T00:00:00.000Z';

  const writeArtifact = async (
    basename: 'exam' | 'answer-key',
    bytes: Uint8Array,
    documentUrl: string,
  ) => {
    await writeFile(path.join(dir, `${basename}.pdf`), bytes);
    await writeFile(path.join(dir, `${basename}.manifest.json`), JSON.stringify({
      schemaVersion: 1,
      sourceUrl: BNDES_2024_SOURCE_URL,
      documentUrl,
      finalUrl: documentUrl,
      documentType: 'pdf',
      usageBasis: 'official-publication',
      license: null,
      termsUrl: null,
      retrievedAt,
      sha256: sha256(bytes),
      contentType: 'application/pdf',
      bytes: bytes.byteLength,
    }));
  };

  await writeArtifact(
    'exam',
    exam,
    'https://www.bndes.gov.br/arquivos/prova%20objetiva%20analise%20de%20sistemas%20desenvolvimento.pdf',
  );
  await writeArtifact(
    'answer-key',
    answerKey,
    'https://www.bndes.gov.br/arquivos/gabarito%20final.pdf',
  );

  return { dir, exam, answerKey };
}

const examPageText = [
  '1',
  'Qual alternativa representa a resposta correta?',
  '(A) alternativa A',
  '(B) alternativa B',
  '(C) alternativa C',
  '(D) alternativa D',
  '(E) alternativa E',
].join('\n');

const answerKeyText = [
  'ANÁLISE DE SISTEMAS - DESENVOLVIMENTO',
  '1 C',
].join('\n');

function fixtureExtractor(exam: Uint8Array, answerKey: Uint8Array) {
  return async (bytes: Uint8Array, role: 'exam' | 'answerKey') => {
    if (role === 'exam') {
      assert.deepEqual(bytes, exam);
      return [{ page: 1, text: examPageText }];
    }
    assert.deepEqual(bytes, answerKey);
    return [{ page: 1, text: answerKeyText }];
  };
}

test('orquestra snapshot validado até OfficialQuestionExtraction preservando proveniência', async () => {
  const snapshot = await createSnapshot();
  const roles: string[] = [];

  try {
    const extraction = await buildBndes2024ExtractionFromSnapshot(
      snapshot.dir,
      async (bytes, role) => {
        roles.push(role);
        return fixtureExtractor(snapshot.exam, snapshot.answerKey)(bytes, role);
      },
    );

    assert.deepEqual(roles, ['exam', 'answerKey']);
    assert.equal(extraction.questions.length, 1);
    assert.equal(extraction.questions[0]?.correctLabel, 'C');
    assert.equal(extraction.questions[0]?.sourcePage, 1);
    assert.equal(extraction.source.sourceHash, sha256(snapshot.exam));
    assert.equal(extraction.answerKey?.url.includes('gabarito%20final.pdf'), true);
    assert.equal(extraction.exam.sourceSha256, sha256(snapshot.exam));
  } finally {
    await rm(snapshot.dir, { recursive: true, force: true });
  }
});

test('produz QuestionImportBatch validado e pronto para deduplicação/persistência', async () => {
  const snapshot = await createSnapshot();

  try {
    const batch = await buildBndes2024ImportBatchFromSnapshot(
      snapshot.dir,
      fixtureExtractor(snapshot.exam, snapshot.answerKey),
    );

    assert.equal(batch.source.type, 'OFFICIAL_PDF');
    assert.equal(batch.board.acronym, 'CESGRANRIO');
    assert.equal(batch.exam.year, 2024);
    assert.equal(batch.questions.length, 1);
    assert.equal(batch.questions[0]?.number, 1);
    assert.equal(batch.questions[0]?.sourcePage, 1);
    assert.deepEqual(
      batch.questions[0]?.choices.map(({ label, isCorrect }) => ({ label, isCorrect })),
      [
        { label: 'A', isCorrect: false },
        { label: 'B', isCorrect: false },
        { label: 'C', isCorrect: true },
        { label: 'D', isCorrect: false },
        { label: 'E', isCorrect: false },
      ],
    );
  } finally {
    await rm(snapshot.dir, { recursive: true, force: true });
  }
});

test('falha fechada quando extrator devolve páginas duplicadas', async () => {
  const snapshot = await createSnapshot();

  try {
    await assert.rejects(
      () => buildBndes2024ExtractionFromSnapshot(
        snapshot.dir,
        async (_bytes, role) => role === 'exam'
          ? [{ page: 1, text: examPageText }, { page: 1, text: examPageText }]
          : [{ page: 1, text: answerKeyText }],
      ),
      /página 1 duplicada em exam/,
    );
  } finally {
    await rm(snapshot.dir, { recursive: true, force: true });
  }
});
