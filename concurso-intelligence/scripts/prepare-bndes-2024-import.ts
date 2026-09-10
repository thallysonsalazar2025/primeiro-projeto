import { randomUUID } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createBndes2024PdftotextExtractor } from '../src/lib/bndes-2024-pdftotext.ts';
import { buildBndes2024ImportBatchFromSnapshot } from '../src/lib/bndes-2024-pipeline.ts';

async function writeJsonAtomically(outputPath: string, content: string) {
  const tempPath = `${outputPath}.tmp-${process.pid}-${randomUUID()}`;

  try {
    await writeFile(tempPath, content, { encoding: 'utf8', flag: 'wx' });
    await rename(tempPath, outputPath);
  } finally {
    await rm(tempPath, { force: true });
  }
}

async function main() {
  const snapshotDirArg = process.argv[2];
  const outputPathArg = process.argv[3];

  if (!snapshotDirArg || !outputPathArg) {
    throw new Error(
      'Uso: npm run ingestion:prepare:bndes-2024 -- <diretorio-snapshot> <batch.json>',
    );
  }

  const snapshotDir = path.resolve(snapshotDirArg);
  const outputPath = path.resolve(outputPathArg);
  const batch = await buildBndes2024ImportBatchFromSnapshot(
    snapshotDir,
    createBndes2024PdftotextExtractor(),
  );

  await writeJsonAtomically(outputPath, `${JSON.stringify(batch, null, 2)}\n`);

  console.log(
    `Batch BNDES 2024 preparado: ${batch.questions.length} questões em ${outputPath}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
