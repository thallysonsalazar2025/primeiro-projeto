import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseIngestionSourceRegistry } from '../src/lib/ingestion-source-registry.ts';
import { runConfiguredIngestionSources } from '../src/lib/ingestion-source-runner.ts';
import { parseIngestionSourceTimeoutMs } from '../src/lib/ingestion-source-timeout.ts';

const SOURCE_TERMINATION_GRACE_MS = 2_000;

function runSource(args: string[], timeoutMs: number) {
  return new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(
      process.execPath,
      ['--experimental-strip-types', resolve('scripts/fetch-external-source.ts'), ...args],
      { stdio: 'inherit', env: process.env },
    );

    let settled = false;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      callback();
    };

    child.once('error', (error) => finish(() => rejectRun(error)));
    child.once('exit', (code, signal) => {
      finish(() => {
        if (timedOut) {
          rejectRun(new Error(`Coleta excedeu timeout de ${timeoutMs} ms e foi encerrada.`));
          return;
        }
        if (code === 0) {
          resolveRun();
          return;
        }
        rejectRun(new Error(`Coleta terminou com ${signal ? `signal ${signal}` : `exit code ${code}`}.`));
      });
    });

    timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      child.kill('SIGTERM');
      forceKillTimer = setTimeout(() => {
        if (!settled) child.kill('SIGKILL');
      }, SOURCE_TERMINATION_GRACE_MS);
    }, timeoutMs);
  });
}

async function main() {
  const registryPath = process.argv[2];
  if (!registryPath) {
    throw new Error('Uso: npm run ingestion:sources -- <registry.json>');
  }

  const registry = parseIngestionSourceRegistry(JSON.parse(await readFile(resolve(registryPath), 'utf8')));
  const timeoutMs = parseIngestionSourceTimeoutMs(process.env.INGESTION_SOURCE_TIMEOUT_MS);
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
    await runSource(args, timeoutMs);
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
