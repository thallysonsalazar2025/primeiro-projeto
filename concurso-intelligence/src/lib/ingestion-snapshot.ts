import { unlink } from 'node:fs/promises';

function isMissingFile(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export async function cleanupOwnedIngestionSnapshot(snapshotPath: string, snapshotCreated: boolean) {
  if (!snapshotCreated) return;

  try {
    await unlink(snapshotPath);
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }
}
