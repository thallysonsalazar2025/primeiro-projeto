import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

export type IngestionKind = 'questions' | 'rankings';

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

  try {
    await writeFile(outputTemp, bytes, { flag: 'wx' });
    await writeFile(manifestTemp, manifest, { encoding: 'utf8', flag: 'wx' });
    await rename(manifestTemp, manifestPath);
    await rename(outputTemp, outputPath);
  } catch (error) {
    await Promise.all([
      rm(outputTemp, { force: true }).catch(() => undefined),
      rm(manifestTemp, { force: true }).catch(() => undefined),
    ]);
    throw error;
  }
}
