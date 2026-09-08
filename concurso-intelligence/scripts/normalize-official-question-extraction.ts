import { randomUUID } from 'node:crypto';
import { rename, rm, writeFile } from 'node:fs/promises';
import {
  parseMaxIngestionFileBytes,
  readIngestionFileWithinLimit,
} from '../src/lib/ingestion-file-size.ts';
import { normalizeOfficialQuestionExtraction } from '../src/lib/official-question-extraction.ts';

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
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath || !outputPath) {
    throw new Error(
      'Uso: npm run ingestion:normalize:official -- <extracao.json> <question-import-batch.json>',
    );
  }

  const maxFileBytes = parseMaxIngestionFileBytes(process.env.INGESTION_MAX_FILE_BYTES);
  const inputBytes = await readIngestionFileWithinLimit(inputPath, maxFileBytes);
  const extraction = JSON.parse(inputBytes.toString('utf8')) as unknown;
  const batch = normalizeOfficialQuestionExtraction(extraction);

  await writeJsonAtomically(outputPath, `${JSON.stringify(batch, null, 2)}\n`);

  console.log(
    `Extração oficial normalizada: ${batch.questions.length} questões prontas para db:import:questions.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
