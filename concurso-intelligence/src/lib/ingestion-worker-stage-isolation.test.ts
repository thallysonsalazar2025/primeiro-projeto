import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('falha em uma etapa do ciclo não impede o processamento das demais filas', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ingestion-stage-isolation-'));
  const inbox = join(root, 'inbox');

  try {
    const processingDir = join(inbox, 'processing');
    await mkdir(processingDir, { recursive: true });
    await writeFile(join(processingDir, 'questions'), 'bloqueia diretório de recovery', 'utf8');

    const rankingsDir = join(inbox, 'rankings');
    await mkdir(rankingsDir, { recursive: true });
    await writeFile(join(rankingsDir, 'ranking-invalid.json'), '{json-invalido', 'utf8');

    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', 'scripts/ingestion-worker.ts'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL || 'postgresql://127.0.0.1:1/invalid',
          INGESTION_INBOX_DIR: inbox,
          INGESTION_ONESHOT: 'true',
        },
        encoding: 'utf8',
        timeout: 10_000,
      },
    );

    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /etapa recovery\/questions falhou; demais etapas do ciclo continuarão/);

    const failedRankings = await readdir(join(inbox, 'failed', 'rankings'));
    assert.ok(
      failedRankings.some((name) => /ranking-invalid\.json$/.test(name)),
      `ranking não foi processado após falha isolada: ${failedRankings.join(', ')}`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
