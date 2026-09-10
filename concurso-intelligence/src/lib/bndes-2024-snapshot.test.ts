import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadBndes2024Snapshot } from './bndes-2024-snapshot.ts';

function manifest(bytes: Uint8Array, documentUrl: string) {
  return {
    schemaVersion: 1,
    sourceUrl: 'https://www.bndes.gov.br/concurso-2024',
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

async function withSnapshot(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'bndes-snapshot-'));
  try {
    const exam = Buffer.from('%PDF-exam');
    const answer = Buffer.from('%PDF-answer');
    await writeFile(path.join(dir, 'exam.pdf'), exam);
    await writeFile(path.join(dir, 'answer-key.pdf'), answer);
    await writeFile(path.join(dir, 'exam.manifest.json'), JSON.stringify(manifest(exam, 'https://www.bndes.gov.br/exam.pdf')));
    await writeFile(path.join(dir, 'answer-key.manifest.json'), JSON.stringify(manifest(answer, 'https://www.bndes.gov.br/answer.pdf')));
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('carrega snapshot íntegro e preserva proveniência', async () => {
  await withSnapshot(async (dir) => {
    const snapshot = await loadBndes2024Snapshot(dir);
    assert.equal(snapshot.exam.manifest.documentType, 'pdf');
    assert.equal(snapshot.answerKey.manifest.sourceUrl, snapshot.exam.manifest.sourceUrl);
  });
});

test('falha fechado quando o PDF diverge do hash do manifesto', async () => {
  await withSnapshot(async (dir) => {
    await writeFile(path.join(dir, 'exam.pdf'), Buffer.from('%PDF-tampered'));
    await assert.rejects(() => loadBndes2024Snapshot(dir), /tamanho divergente|hash SHA-256 divergente/);
  });
});
