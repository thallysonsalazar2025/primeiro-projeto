import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

async function waitUntil(predicate: () => boolean | Promise<boolean>, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Condição não atendida em ${timeoutMs}ms`);
}

test('worker contínuo sobrevive a falha transitória de filesystem e processa o ciclo seguinte', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ingestion-continuous-'));
  const inbox = join(root, 'inbox');
  await writeFile(inbox, 'bloqueio transitório', 'utf8');

  const child = spawn(
    process.execPath,
    ['--experimental-strip-types', 'scripts/ingestion-worker.ts'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://127.0.0.1:1/invalid',
        INGESTION_INBOX_DIR: inbox,
        INGESTION_INTERVAL_SECONDS: '1',
        INGESTION_ONESHOT: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });

  try {
    await waitUntil(
      () => stderr.includes('etapa recovery/questions falhou; demais etapas do ciclo continuarão'),
      3_000,
    );
    assert.equal(child.exitCode, null, stderr);

    await rm(inbox, { force: true });
    const questionsDir = join(inbox, 'questions');
    await mkdir(questionsDir, { recursive: true });
    await writeFile(join(questionsDir, 'invalid-after-recovery.json'), '{json-invalido', 'utf8');

    await waitUntil(async () => {
      try {
        const failedFiles = await readdir(join(inbox, 'failed', 'questions'));
        return failedFiles.some((name) => /invalid-after-recovery\.json$/.test(name));
      } catch {
        return false;
      }
    }, 6_000);

    assert.equal(child.exitCode, null, stderr);
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await once(child, 'exit');
    }
    await rm(root, { recursive: true, force: true });
  }
});
