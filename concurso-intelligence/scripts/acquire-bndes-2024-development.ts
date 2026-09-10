import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchBndes2024DevelopmentDocuments } from '../src/lib/bndes-2024-source.ts';
import { parseIngestionSourceTimeoutMs } from '../src/lib/ingestion-source-timeout.ts';

async function main() {
  const outputDirArg = process.argv[2];
  if (!outputDirArg) {
    throw new Error('Uso: npm run ingestion:acquire:bndes-2024 -- <diretorio-saida>');
  }

  const outputDir = path.resolve(outputDirArg);
  const parentDir = path.dirname(outputDir);
  const stagingDir = path.join(parentDir, `.${path.basename(outputDir)}.tmp-${process.pid}-${randomUUID()}`);
  const timeoutMs = parseIngestionSourceTimeoutMs(process.env.INGESTION_SOURCE_TIMEOUT_MS);

  await mkdir(parentDir, { recursive: true });
  await mkdir(stagingDir);

  try {
    const acquisition = await fetchBndes2024DevelopmentDocuments({ timeoutMs });
    const artifacts = [
      ['exam.pdf', acquisition.exam.bytes] as const,
      ['answer-key.pdf', acquisition.answerKey.bytes] as const,
      ['exam.manifest.json', `${JSON.stringify(acquisition.exam.manifest, null, 2)}\n`] as const,
      ['answer-key.manifest.json', `${JSON.stringify(acquisition.answerKey.manifest, null, 2)}\n`] as const,
      ['catalog.json', `${JSON.stringify(acquisition.catalog, null, 2)}\n`] as const,
    ];

    for (const [name, content] of artifacts) {
      await writeFile(path.join(stagingDir, name), content, { flag: 'wx' });
    }

    // Publica o conjunto inteiro de uma vez. Se outputDir já existir, rename falha
    // em vez de misturar arquivos de aquisições diferentes: cada snapshot é imutável.
    await rename(stagingDir, outputDir);

    console.log(
      `BNDES 2024 adquirido com proveniência em snapshot imutável ${outputDir}: ${acquisition.exam.manifest.sha256} / ${acquisition.answerKey.manifest.sha256}`,
    );
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true });
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
