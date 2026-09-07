import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseIngestionSourceRegistry } from '../src/lib/ingestion-source-registry.ts';
import { runConfiguredIngestionSources } from '../src/lib/ingestion-source-runner.ts';

function runSource(args: string[]) {
  return new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(
      process.execPath,
      ['--experimental-strip-types', resolve('scripts/fetch-external-source.ts'), ...args],
      { stdio: 'inherit', env: process.env },
    );

    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveRun();
        return;
      }
      rejectRun(new Error(`Coleta terminou com ${signal ? `signal ${signal}` : `exit code ${code}`}.`));
    });
  });
}

async function main() {
  const registryPath = process.argv[2];
  if (!registryPath) {
    throw new Error('Uso: npm run ingestion:sources -- <registry.json>');
  }

  const registry = parseIngestionSourceRegistry(JSON.parse(await readFile(resolve(registryPath), 'utf8')));
  const result = await runConfiguredIngestionSources(registry.sources, async (source) => {
    console.log(`[ingestion:sources] coletando ${source.id}`);
    const args = [
      source.url,
      '--enqueue',
      source.enqueue,
      '--name-prefix',
      source.namePrefix,
    ];
    if (source.expectedSha256) args.push('--sha256', source.expectedSha256);
    await runSource(args);
  });

  for (const failure of result.failures) {
    console.error(`[ingestion:sources] falha em ${failure.id}: ${failure.error.message}`);
  }

  console.log(
    `[ingestion:sources] ${result.succeeded}/${result.attempted} fonte(s) processada(s) com sucesso.`,
  );

  if (result.failures.length > 0) {
    throw new Error(`${result.failures.length} fonte(s) falharam durante a coleta.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
