import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchBndes2024DevelopmentDocuments } from '../src/lib/bndes-2024-source.ts';

async function writeAtomically(filePath: string, content: Uint8Array | string) {
  const tempPath = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(tempPath, content);
    await rename(tempPath, filePath);
  } finally {
    await rm(tempPath, { force: true });
  }
}

async function main() {
  const outputDirArg = process.argv[2];
  if (!outputDirArg) {
    throw new Error('Uso: npm run ingestion:acquire:bndes-2024 -- <diretorio-saida>');
  }

  const outputDir = path.resolve(outputDirArg);
  await mkdir(outputDir, { recursive: true });

  const acquisition = await fetchBndes2024DevelopmentDocuments();
  const artifacts = [
    ['exam.pdf', acquisition.exam.bytes] as const,
    ['answer-key.pdf', acquisition.answerKey.bytes] as const,
    ['exam.manifest.json', `${JSON.stringify(acquisition.exam.manifest, null, 2)}\n`] as const,
    ['answer-key.manifest.json', `${JSON.stringify(acquisition.answerKey.manifest, null, 2)}\n`] as const,
    ['catalog.json', `${JSON.stringify(acquisition.catalog, null, 2)}\n`] as const,
  ];

  for (const [name, content] of artifacts) {
    await writeAtomically(path.join(outputDir, name), content);
  }

  console.log(
    `BNDES 2024 adquirido com proveniência: ${acquisition.exam.manifest.sha256} / ${acquisition.answerKey.manifest.sha256}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
