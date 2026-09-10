import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createBndes2024PdftotextExtractor } from '../src/lib/bndes-2024-pdftotext.ts';
import { buildBndes2024ImportBatchFromSnapshot } from '../src/lib/bndes-2024-pipeline.ts';

function runQuestionImporter(batchPath: string, reportPath?: string) {
  const importerPath = fileURLToPath(new URL('./import-questions-json.ts', import.meta.url));
  const args = ['--experimental-strip-types', importerPath, batchPath];
  if (reportPath) args.push('--report', reportPath);

  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: process.env,
      shell: false,
    });

    let forwardedSignal: NodeJS.Signals | undefined;

    const forwardSignal = (signal: NodeJS.Signals) => {
      forwardedSignal = signal;
      if (child.exitCode === null && child.signalCode === null) {
        child.kill(signal);
      }
    };

    const onSigint = () => forwardSignal('SIGINT');
    const onSigterm = () => forwardSignal('SIGTERM');

    process.once('SIGINT', onSigint);
    process.once('SIGTERM', onSigterm);

    const cleanupSignalHandlers = () => {
      process.off('SIGINT', onSigint);
      process.off('SIGTERM', onSigterm);
    };

    child.once('error', (error) => {
      cleanupSignalHandlers();
      reject(error);
    });
    child.once('exit', (code, signal) => {
      cleanupSignalHandlers();
      if (forwardedSignal) {
        reject(new Error(`Importação interrompida por ${forwardedSignal}.`));
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Importador de questões falhou (code=${code ?? 'null'}, signal=${signal ?? 'null'}).`));
      }
    });
  });
}

async function main() {
  const snapshotDirArg = process.argv[2];
  const reportFlagIndex = process.argv.indexOf('--report');
  const reportPathArg = reportFlagIndex >= 0 ? process.argv[reportFlagIndex + 1] : undefined;

  if (!snapshotDirArg) {
    throw new Error('Uso: npm run db:import:bndes-2024 -- <diretorio-snapshot> [--report <relatorio.json>]');
  }
  if (reportFlagIndex >= 0 && !reportPathArg) {
    throw new Error('--report requer um caminho de arquivo.');
  }

  const snapshotDir = path.resolve(snapshotDirArg);
  const reportPath = reportPathArg ? path.resolve(reportPathArg) : undefined;
  const tempDir = path.join(os.tmpdir(), `concurso-bndes-import-${process.pid}-${randomUUID()}`);
  const batchPath = path.join(tempDir, 'batch.json');

  await mkdir(tempDir, { recursive: false, mode: 0o700 });
  try {
    const batch = await buildBndes2024ImportBatchFromSnapshot(
      snapshotDir,
      createBndes2024PdftotextExtractor(),
    );
    await writeFile(batchPath, `${JSON.stringify(batch, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await runQuestionImporter(batchPath, reportPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
