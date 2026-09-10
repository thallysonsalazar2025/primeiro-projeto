import { randomUUID } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createBndes2024PdftotextExtractor } from '../src/lib/bndes-2024-pdftotext.ts';
import { buildBndes2024ExtractionFromSnapshot } from '../src/lib/bndes-2024-pipeline.ts';

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
      'Uso: npm run ingestion:extract:bndes-2024 -- <diretorio-snapshot> <extracao.json>',
    );
  }

  const snapshotDir = path.resolve(snapshotDirArg);
  const outputPath = path.resolve(outputPathArg);
  const extraction = await buildBndes2024ExtractionFromSnapshot(
    snapshotDir,
    createBndes2024PdftotextExtractor(),
  );

  await writeJsonAtomically(outputPath, `${JSON.stringify(extraction, null, 2)}\n`);

  console.log(
    `BNDES 2024 extraído: ${extraction.questions.length} questões em ${outputPath}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
