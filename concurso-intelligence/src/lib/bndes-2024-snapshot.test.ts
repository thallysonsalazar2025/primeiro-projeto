import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BNDES_2024_SOURCE_URL } from './bndes-2024-source.ts';
import { loadBndes2024Snapshot } from './bndes-2024-snapshot.ts';

function manifest(bytes: Uint8Array, documentUrl: string, sourceUrl = BNDES_2024_SOURCE_URL) {
  return {
    schemaVersion: 1,
    sourceUrl,
    documentUrl,
    finalUrl: documentUrl,
    documentType: 'pdf',
    usageBasis: 'official-publication',
    license: null,
    termsUrl: null,
    retrievedAt: '2026-09-10T00:00:00.000Z',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    contentType: 'application/pdf',
    bytes: bytes.byteLength,
  };
}

const EXAM_URL = 'https://www.bndes.gov.br/provas/objetiva-analise-de-sistemas-desenvolvimento.pdf';
const ANSWER_URL = 'https://www.bndes.gov.br/provas/gabarito-final.pdf';

async function withSnapshot(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'bndes-snapshot-'));
  try {
    const exam = Buffer.from('%PDF-exam');
    const answer = Buffer.from('%PDF-answer');
    await writeFile(path.join(dir, 'exam.pdf'), exam);
    await writeFile(path.join(dir, 'answer-key.pdf'), answer);
    await writeFile(path.join(dir, 'exam.manifest.json'), JSON.stringify(manifest(exam, EXAM_URL)));
    await writeFile(path.join(dir, 'answer-key.manifest.json'), JSON.stringify(manifest(answer, ANSWER_URL)));
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('carrega snapshot íntegro e preserva proveniência', async () => {
  await withSnapshot(async (dir) => {
    const snapshot = await loadBndes2024Snapshot(dir);
    assert.equal(snapshot.exam.manifest.documentType, 'pdf');
    assert.equal(snapshot.answerKey.manifest.sourceUrl, BNDES_2024_SOURCE_URL);
  });
});

test('falha fechado quando o PDF diverge do hash do manifesto', async () => {
  await withSnapshot(async (dir) => {
    await writeFile(path.join(dir, 'exam.pdf'), Buffer.from('%PDF-tampered'));
    await assert.rejects(() => loadBndes2024Snapshot(dir), /tamanho divergente|hash SHA-256 divergente/);
  });
});

test('rejeita snapshot de fonte não canônica', async () => {
  await withSnapshot(async (dir) => {
    const exam = Buffer.from('%PDF-exam');
    const answer = Buffer.from('%PDF-answer');
    const sourceUrl = 'https://example.org/concurso';
    await writeFile(path.join(dir, 'exam.manifest.json'), JSON.stringify(manifest(exam, EXAM_URL, sourceUrl)));
    await writeFile(path.join(dir, 'answer-key.manifest.json'), JSON.stringify(manifest(answer, ANSWER_URL, sourceUrl)));
    await assert.rejects(() => loadBndes2024Snapshot(dir), /fonte canônica esperada/);
  });
});

test('rejeita UTF-8 malformado no manifesto', async () => {
  await withSnapshot(async (dir) => {
    await writeFile(path.join(dir, 'exam.manifest.json'), Uint8Array.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d]));
    await assert.rejects(() => loadBndes2024Snapshot(dir), /UTF-8 válido/);
  });
});

test('rejeita manifesto acima do limite antes do parsing', async () => {
  await withSnapshot(async (dir) => {
    await writeFile(path.join(dir, 'exam.manifest.json'), Buffer.alloc(64 * 1024 + 1, 0x20));
    await assert.rejects(() => loadBndes2024Snapshot(dir), /excede o limite/);
  });
});

test('rejeita papéis de prova e gabarito trocados', async () => {
  await withSnapshot(async (dir) => {
    const exam = Buffer.from('%PDF-exam');
    const answer = Buffer.from('%PDF-answer');
    await writeFile(path.join(dir, 'exam.manifest.json'), JSON.stringify(manifest(exam, ANSWER_URL)));
    await writeFile(path.join(dir, 'answer-key.manifest.json'), JSON.stringify(manifest(answer, EXAM_URL)));
    await assert.rejects(() => loadBndes2024Snapshot(dir), /esperado exatamente 1|papéis de prova e gabarito/);
  });
});
