import { spawn } from 'node:child_process';
import { mkdir, readdir, rename, stat, utimes } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  assertIngestionFileSize,
  parseMaxIngestionFileBytes,
} from '../src/lib/ingestion-file-size.ts';

const inboxRoot = process.env.INGESTION_INBOX_DIR?.trim() || '/imports';
const intervalSeconds = parsePositiveInteger(process.env.INGESTION_INTERVAL_SECONDS, 60);
const staleClaimSeconds = parsePositiveInteger(process.env.INGESTION_STALE_CLAIM_SECONDS, 3600);
const maxFileBytes = parseMaxIngestionFileBytes(process.env.INGESTION_MAX_FILE_BYTES);
const oneShot = process.env.INGESTION_ONESHOT === 'true';

type ImportKind = 'questions' | 'rankings';

const importers: Record<ImportKind, string> = {
  questions: 'scripts/import-questions-json.ts',
  rankings: 'scripts/import-official-ranking-json.ts',
};

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) {
    throw new Error(`Valor inválido para intervalo do worker: ${value}`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Valor inválido para intervalo do worker: ${value}`);
  }
  return parsed;
}

async function moveToBucket(filePath: string, kind: ImportKind, bucket: 'processed' | 'failed') {
  const destinationDir = join(inboxRoot, bucket, kind);
  await mkdir(destinationDir, { recursive: true });

  const originalName = basename(filePath);
  const destination = join(destinationDir, `${Date.now()}-${originalName}`);
  await rename(filePath, destination);
  return destination;
}

async function claimFile(filePath: string, kind: ImportKind) {
  const processingDir = join(inboxRoot, 'processing', kind);
  await mkdir(processingDir, { recursive: true });

  const claimedPath = join(processingDir, `${Date.now()}-${process.pid}-${basename(filePath)}`);
  await rename(filePath, claimedPath);
  return claimedPath;
}

function runImporter(importer: string, filePath: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', importer, filePath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolve();
      reject(new Error(`Importador ${importer} falhou para ${filePath} (code=${code ?? 'null'}, signal=${signal ?? 'none'})`));
    });
  });
}

function startClaimHeartbeat(claimedPath: string) {
  const heartbeatMs = Math.max(1000, Math.floor((staleClaimSeconds * 1000) / 3));
  const timer = setInterval(() => {
    const now = new Date();
    void utimes(claimedPath, now, now).catch(() => undefined);
  }, heartbeatMs);
  timer.unref();
  return timer;
}

async function processClaimedFile(claimedPath: string, kind: ImportKind) {
  const heartbeat = startClaimHeartbeat(claimedPath);
  try {
    const metadata = await stat(claimedPath);
    assertIngestionFileSize(metadata.size, maxFileBytes);
    console.log(`[ingestion-worker] importando ${kind}: ${claimedPath}`);
    await runImporter(importers[kind], claimedPath);
    const archivedPath = await moveToBucket(claimedPath, kind, 'processed');
    console.log(`[ingestion-worker] concluído: ${archivedPath}`);
  } catch (error) {
    try {
      const failedPath = await moveToBucket(claimedPath, kind, 'failed');
      console.error(`[ingestion-worker] falha; arquivo isolado em ${failedPath}`);
      console.error(error instanceof Error ? error.message : error);
    } catch (archiveError) {
      console.error(`[ingestion-worker] falha ao isolar lote já reivindicado: ${claimedPath}`);
      console.error(archiveError instanceof Error ? archiveError.message : archiveError);
      throw archiveError;
    }
  } finally {
    clearInterval(heartbeat);
  }
}

async function isStaleClaim(filePath: string) {
  const metadata = await stat(filePath);
  return Date.now() - metadata.mtimeMs >= staleClaimSeconds * 1000;
}

async function recoverClaimedFiles(kind: ImportKind) {
  const processingDir = join(inboxRoot, 'processing', kind);
  await mkdir(processingDir, { recursive: true });

  const files = (await readdir(processingDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => join(processingDir, entry.name))
    .sort();

  for (const claimedPath of files) {
    if (!(await isStaleClaim(claimedPath))) continue;
    console.warn(`[ingestion-worker] recuperando lote interrompido: ${claimedPath}`);
    await processClaimedFile(claimedPath, kind);
  }
}

async function processKind(kind: ImportKind) {
  const sourceDir = join(inboxRoot, kind);
  await mkdir(sourceDir, { recursive: true });

  const files = (await readdir(sourceDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => join(sourceDir, entry.name))
    .sort();

  for (const filePath of files) {
    let claimedPath: string;
    try {
      claimedPath = await claimFile(filePath, kind);
    } catch (error) {
      console.error(`[ingestion-worker] falha ao reivindicar arquivo; lote permanece na fila: ${filePath}`);
      console.error(error instanceof Error ? error.message : error);
      continue;
    }

    await processClaimedFile(claimedPath, kind);
  }
}

async function recoverInterruptedBatches() {
  await recoverClaimedFiles('questions');
  await recoverClaimedFiles('rankings');
}

async function runCycle() {
  await recoverInterruptedBatches();
  await processKind('questions');
  await processKind('rankings');
}

async function main() {
  console.log(
    `[ingestion-worker] inbox=${inboxRoot} interval=${intervalSeconds}s staleClaim=${staleClaimSeconds}s maxFileBytes=${maxFileBytes} oneShot=${oneShot}`,
  );

  do {
    await runCycle();
    if (!oneShot) await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
  } while (!oneShot);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
