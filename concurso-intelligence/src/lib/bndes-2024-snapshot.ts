import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseOfficialDocumentManifest } from './official-document-manifest.ts';

export type Bndes2024Snapshot = {
  exam: { bytes: Uint8Array; manifest: ReturnType<typeof parseOfficialDocumentManifest> };
  answerKey: { bytes: Uint8Array; manifest: ReturnType<typeof parseOfficialDocumentManifest> };
};

function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function loadArtifact(snapshotDir: string, basename: 'exam' | 'answer-key') {
  const pdfPath = path.join(snapshotDir, `${basename}.pdf`);
  const manifestPath = path.join(snapshotDir, `${basename}.manifest.json`);
  const [bytes, rawManifest] = await Promise.all([
    readFile(pdfPath),
    readFile(manifestPath, 'utf8'),
  ]);

  const manifest = parseOfficialDocumentManifest(JSON.parse(rawManifest));
  if (manifest.documentType !== 'pdf') {
    throw new Error(`BNDES 2024: ${basename} deve ser PDF.`);
  }
  if (manifest.bytes !== bytes.byteLength) {
    throw new Error(`BNDES 2024: tamanho divergente em ${basename}.pdf.`);
  }
  if (manifest.sha256 !== sha256(bytes)) {
    throw new Error(`BNDES 2024: hash SHA-256 divergente em ${basename}.pdf.`);
  }

  return { bytes, manifest };
}

export async function loadBndes2024Snapshot(snapshotDir: string): Promise<Bndes2024Snapshot> {
  const resolved = path.resolve(snapshotDir);
  const [exam, answerKey] = await Promise.all([
    loadArtifact(resolved, 'exam'),
    loadArtifact(resolved, 'answer-key'),
  ]);

  if (exam.manifest.sourceUrl !== answerKey.manifest.sourceUrl) {
    throw new Error('BNDES 2024: prova e gabarito pertencem a fontes diferentes.');
  }
  if (exam.manifest.sha256 === answerKey.manifest.sha256) {
    throw new Error('BNDES 2024: prova e gabarito não podem ser o mesmo artefato.');
  }

  return { exam, answerKey };
}
