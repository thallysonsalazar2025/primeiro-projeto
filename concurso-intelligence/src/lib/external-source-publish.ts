import { link, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { decodeIngestionUtf8, readIngestionFileWithinLimit } from './ingestion-file-size.ts';

export type IngestionKind = 'questions' | 'rankings';

export type LatestPublication = {
  schemaVersion: 1;
  sequence: number;
  sha256: string;
  output: string;
  manifest: string;
  usageBasis?: 'official' | 'open-data' | 'licensed' | null;
};

const LATEST_PUBLICATION_MAX_BYTES = 64 * 1024;

function validatePrefix(prefix: string) {
  if (!prefix || basename(prefix) !== prefix || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(prefix)) {
    throw new Error('Prefixo do lote deve ser simples, sem diretórios, com até 64 caracteres seguros.');
  }
}

function validateSha256(sha256: string) {
  if (!/^[a-f0-9]{64}$/i.test(sha256)) {
    throw new Error('SHA-256 inválido para nome endereçado por conteúdo.');
  }
}

export function contentAddressedEnqueueName(prefix: string, sequence: number, sha256: string) {
  validatePrefix(prefix);
  validateSha256(sha256);
  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new Error('Sequência de publicação inválida.');
  }

  return `${prefix}-${String(sequence).padStart(12, '0')}-${sha256.toLowerCase()}.json`;
}

export function planEnqueuePaths(inboxRoot: string, kind: IngestionKind, name: string) {
  if (!name || basename(name) !== name || !name.toLowerCase().endsWith('.json')) {
    throw new Error('Nome do lote deve ser um arquivo .json sem diretórios.');
  }

  const root = resolve(inboxRoot);
  return {
    outputPath: join(root, kind, name),
    manifestPath: join(root, 'metadata', kind, `${name}.source.json`),
  };
}

export function planLatestPublicationPaths(inboxRoot: string, kind: IngestionKind, prefix: string) {
  validatePrefix(prefix);
  const root = resolve(inboxRoot);
  const metadataDir = join(root, 'metadata', kind);
  return {
    latestPath: join(metadataDir, `${prefix}.latest.json`),
    lockPath: join(metadataDir, `${prefix}.latest.lock`),
  };
}

export async function readLatestPublication(latestPath: string): Promise<LatestPublication | null> {
  try {
    const raw = await readIngestionFileWithinLimit(latestPath, LATEST_PUBLICATION_MAX_BYTES);
    const parsed = JSON.parse(decodeIngestionUtf8(raw)) as Partial<LatestPublication>;
    if (
      parsed.schemaVersion !== 1
      || !Number.isSafeInteger(parsed.sequence)
      || Number(parsed.sequence) <= 0
      || typeof parsed.sha256 !== 'string'
      || !/^[a-f0-9]{64}$/i.test(parsed.sha256)
      || typeof parsed.output !== 'string'
      || typeof parsed.manifest !== 'string'
      || (parsed.usageBasis !== undefined
        && parsed.usageBasis !== null
        && parsed.usageBasis !== 'official'
        && parsed.usageBasis !== 'open-data'
        && parsed.usageBasis !== 'licensed')
    ) {
      throw new Error(`Marcador de publicação incremental inválido: ${latestPath}`);
    }
    return parsed as LatestPublication;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function writeLatestPublication(latestPath: string, publication: LatestPublication) {
  await mkdir(dirname(latestPath), { recursive: true });
  const tempPath = `${latestPath}.${process.pid}-${Date.now()}.part`;
  try {
    await writeFile(tempPath, `${JSON.stringify(publication, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(tempPath, latestPath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => undefined);
  }
}

export async function withPublicationLock<T>(lockPath: string, action: () => Promise<T>) {
  await mkdir(dirname(lockPath), { recursive: true });
  let acquired = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await mkdir(lockPath);
      acquired = true;
      break;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
    }
  }
  if (!acquired) throw new Error(`Timeout aguardando lock de publicação incremental: ${lockPath}`);

  try {
    return await action();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
}

export async function publishAtomically(
  outputPath: string,
  manifestPath: string,
  bytes: Uint8Array,
  manifest: string,
) {
  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(manifestPath), { recursive: true });

  const token = `${process.pid}-${Date.now()}`;
  const outputTemp = `${outputPath}.${token}.part`;
  const manifestTemp = `${manifestPath}.${token}.part`;
  let outputPublished = false;
  let manifestPublished = false;

  try {
    await writeFile(outputTemp, bytes, { flag: 'wx' });
    await writeFile(manifestTemp, manifest, { encoding: 'utf8', flag: 'wx' });

    await link(outputTemp, outputPath);
    outputPublished = true;
    await link(manifestTemp, manifestPath);
    manifestPublished = true;

    await Promise.all([
      rm(outputTemp, { force: true }),
      rm(manifestTemp, { force: true }),
    ]);
  } catch (error) {
    await Promise.all([
      rm(outputTemp, { force: true }).catch(() => undefined),
      rm(manifestTemp, { force: true }).catch(() => undefined),
      manifestPublished ? rm(manifestPath, { force: true }).catch(() => undefined) : Promise.resolve(),
      outputPublished ? rm(outputPath, { force: true }).catch(() => undefined) : Promise.resolve(),
    ]);
    throw error;
  }
}
