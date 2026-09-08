import { readFile, writeFile } from 'node:fs/promises';
import { normalizeOfficialQuestionExtraction } from '../src/lib/official-question-extraction.ts';

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath || !outputPath) {
    throw new Error(
      'Uso: npm run ingestion:normalize:official -- <extracao.json> <question-import-batch.json>',
    );
  }

  const raw = await readFile(inputPath, 'utf8');
  const extraction = JSON.parse(raw) as unknown;
  const batch = normalizeOfficialQuestionExtraction(extraction);

  await writeFile(outputPath, `${JSON.stringify(batch, null, 2)}\n`, 'utf8');

  console.log(
    `Extração oficial normalizada: ${batch.questions.length} questões prontas para db:import:questions.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
