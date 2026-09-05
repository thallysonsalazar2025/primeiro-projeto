import assert from 'node:assert/strict';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { cleanupOwnedIngestionSnapshot } from './ingestion-snapshot.ts';

test('não remove snapshot quando este worker não é o proprietário', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ingestion-snapshot-'));
  const snapshotPath = join(dir, 'batch.snapshot');

  try {
    await writeFile(snapshotPath, 'foreign');
    await cleanupOwnedIngestionSnapshot(snapshotPath, false);
    await access(snapshotPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('remove snapshot criado por este worker', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ingestion-snapshot-'));
  const snapshotPath = join(dir, 'batch.snapshot');

  try {
    await writeFile(snapshotPath, 'owned');
    await cleanupOwnedIngestionSnapshot(snapshotPath, true);
    await assert.rejects(access(snapshotPath), { code: 'ENOENT' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('cleanup é idempotente quando snapshot próprio já desapareceu', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ingestion-snapshot-'));
  const snapshotPath = join(dir, 'missing.snapshot');

  try {
    await cleanupOwnedIngestionSnapshot(snapshotPath, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
