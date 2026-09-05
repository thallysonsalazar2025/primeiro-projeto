import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('worker oneshot retorna erro e isola lote inválido', async () => {
  const inbox = await mkdtemp(join(tmpdir(), 'ingestion-oneshot-'));

  try {
    const questionsDir = join(inbox, 'questions');
    await mkdir(questionsDir, { recursive: true });
    await writeFile(join(questionsDir, 'invalid.json'), '{json-invalido', 'utf8');

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
    assert.equal(result.status, 1, `stdout=${result.stdout}\nstderr=${result.stderr}`);
    assert.match(result.stderr, /Ciclo de ingestão oneshot concluído com um ou mais lotes com falha/);

    const failedFiles = await readdir(join(inbox, 'failed', 'questions'));
    assert.equal(failedFiles.length, 1);
    assert.match(failedFiles[0], /invalid\.json$/);
  } finally {
    await rm(inbox, { recursive: true, force: true });
  }
});

test('worker oneshot continua processando rankings após falha em questões', async () => {
  const inbox = await mkdtemp(join(tmpdir(), 'ingestion-oneshot-multi-'));

  try {
    const questionsDir = join(inbox, 'questions');
    const rankingsDir = join(inbox, 'rankings');
    await mkdir(questionsDir, { recursive: true });
    await mkdir(rankingsDir, { recursive: true });
    await writeFile(join(questionsDir, 'invalid-question.json'), '{json-invalido', 'utf8');
    await writeFile(join(rankingsDir, 'invalid-ranking.json'), '{json-invalido', 'utf8');

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
    assert.equal(result.status, 1, `stdout=${result.stdout}\nstderr=${result.stderr}`);

    const failedQuestions = await readdir(join(inbox, 'failed', 'questions'));
    const failedRankings = await readdir(join(inbox, 'failed', 'rankings'));
    assert.equal(failedQuestions.length, 1);
    assert.match(failedQuestions[0], /invalid-question\.json$/);
    assert.equal(failedRankings.length, 1);
    assert.match(failedRankings[0], /invalid-ranking\.json$/);
  } finally {
    await rm(inbox, { recursive: true, force: true });
  }
});
