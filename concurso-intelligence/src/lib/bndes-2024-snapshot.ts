import { createHash } from 'node:crypto';
import path from 'node:path';
import { BNDES_2024_SOURCE_URL, selectBndes2024DevelopmentDocuments } from './bndes-2024-source.ts';
import { decodeIngestionUtf8, readIngestionFileWithinLimit } from './ingestion-file-size.ts';
import { parseOfficialDocumentManifest } from './official-document-manifest.ts';

const BNDES_2024_PDF_MAX_BYTES = 2 * 1024 * 1024;
const BNDES_2024_MANIFEST_MAX_BYTES = 64 * 1024;

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
  const [bytes, rawManifestBytes] = await Promise.all([
    readIngestionFileWithinLimit(pdfPath, BNDES_2024_PDF_MAX_BYTES),
    readIngestionFileWithinLimit(manifestPath, BNDES_2024_MANIFEST_MAX_BYTES),
  ]);

  const manifest = parseOfficialDocumentManifest(JSON.parse(decodeIngestionUtf8(rawManifestBytes)));
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

  if (exam.manifest.sourceUrl !== BNDES_2024_SOURCE_URL || answerKey.manifest.sourceUrl !== BNDES_2024_SOURCE_URL) {
    throw new Error('BNDES 2024: snapshot não pertence à fonte canônica esperada.');
  }
  if (exam.manifest.sourceUrl !== answerKey.manifest.sourceUrl) {
    throw new Error('BNDES 2024: prova e gabarito pertencem a fontes diferentes.');
  }
  if (exam.manifest.sha256 === answerKey.manifest.sha256) {
    throw new Error('BNDES 2024: prova e gabarito não podem ser o mesmo artefato.');
  }

  const selection = selectBndes2024DevelopmentDocuments([
    {
      sourceUrl: exam.manifest.sourceUrl,
      documentUrl: exam.manifest.documentUrl,
      documentType: exam.manifest.documentType,
    },
    {
      sourceUrl: answerKey.manifest.sourceUrl,
      documentUrl: answerKey.manifest.documentUrl,
      documentType: answerKey.manifest.documentType,
    },
  ]);
  if (selection.exam.documentUrl !== exam.manifest.documentUrl || selection.answerKey.documentUrl !== answerKey.manifest.documentUrl) {
    throw new Error('BNDES 2024: papéis de prova e gabarito não correspondem aos artefatos esperados.');
  }

  return { exam, answerKey };
}
