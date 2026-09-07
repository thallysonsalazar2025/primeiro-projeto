import { link, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

export type IngestionKind = 'questions' | 'rankings';

export function contentAddressedEnqueueName(prefix: string, sha256: string) {
  if (!prefix || basename(prefix) !== prefix || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(prefix)) {
    throw new Error('Prefixo do lote deve ser simples, sem diretórios, com até 64 caracteres seguros.');
  }
  if (!/^[a-f0-9]{64}$/i.test(sha256)) {
    throw new Error('SHA-256 inválido para nome endereçado por conteúdo.');
  }

  return `${prefix}-${sha256.toLowerCase().slice(0, 12)}.json`;
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

export async function hasPublishedSha(manifestPath: string, sha256: string) {
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { sha256?: unknown };
    return typeof manifest.sha256 === 'string' && manifest.sha256.toLowerCase() === sha256.toLowerCase();
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
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
  let manifestPublished = false;
  let outputPublished = false;

  try {
    await writeFile(outputTemp, bytes, { flag: 'wx' });
    await writeFile(manifestTemp, manifest, { encoding: 'utf8', flag: 'wx' });

    // Publica primeiro a evidência de proveniência e usa hard links para
    // reivindicar os nomes finais sem sobrescrever um lote já existente.
    await link(manifestTemp, manifestPath);
    manifestPublished = true;
    await link(outputTemp, outputPath);
    outputPublished = true;

    await Promise.all([
      rm(outputTemp, { force: true }),
      rm(manifestTemp, { force: true }),
    ]);
  } catch (error) {
    await Promise.all([
      rm(outputTemp, { force: true }).catch(() => undefined),
      rm(manifestTemp, { force: true }).catch(() => undefined),
      outputPublished ? rm(outputPath, { force: true }).catch(() => undefined) : Promise.resolve(),
      manifestPublished ? rm(manifestPath, { force: true }).catch(() => undefined) : Promise.resolve(),
    ]);
    throw error;
  }
}
