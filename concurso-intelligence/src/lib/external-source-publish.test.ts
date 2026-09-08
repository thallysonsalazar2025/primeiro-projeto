import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  contentAddressedEnqueueName,
  planEnqueuePaths,
  planLatestPublicationPaths,
  publishAtomically,
  readLatestPublication,
  withPublicationLock,
  writeLatestPublication,
} from './external-source-publish.ts';

test('gera nome ordenável por sequência usando SHA-256 completo', () => {
  const sha = 'A'.repeat(64);
  assert.equal(
    contentAddressedEnqueueName('prova-sefaz-2026', 2, sha),
    `prova-sefaz-2026-000000000002-${'a'.repeat(64)}.json`,
  );
});

test('rejeita prefixo inseguro, sequência inválida ou SHA-256 inválido', () => {
  assert.throws(() => contentAddressedEnqueueName('../prova', 1, 'a'.repeat(64)), /Prefixo do lote/);
  assert.throws(() => contentAddressedEnqueueName('prova', 0, 'a'.repeat(64)), /Sequência de publicação inválida/);
  assert.throws(() => contentAddressedEnqueueName('prova', 1, 'abc'), /SHA-256 inválido/);
});

test('planeja lote na fila e manifesto fora do diretório observado pelo worker', () => {
  const planned = planEnqueuePaths('/imports', 'questions', 'prova-2026.json');
  assert.equal(planned.outputPath, '/imports/questions/prova-2026.json');
  assert.equal(planned.manifestPath, '/imports/metadata/questions/prova-2026.json.source.json');
});

test('planeja marcador latest e lock fora da fila', () => {
  const planned = planLatestPublicationPaths('/imports', 'rankings', 'sefaz-sc');
  assert.equal(planned.latestPath, '/imports/metadata/rankings/sefaz-sc.latest.json');
  assert.equal(planned.lockPath, '/imports/metadata/rankings/sefaz-sc.latest.lock');
});

test('rejeita nome de lote com path traversal ou extensão diferente de json', () => {
  assert.throws(() => planEnqueuePaths('/imports', 'questions', '../evil.json'), /arquivo .json sem diretórios/);
  assert.throws(() => planEnqueuePaths('/imports', 'questions', 'lote.txt'), /arquivo .json sem diretórios/);
});

test('publica lote e manifesto sem deixar arquivo parcial visível', async () => {
  const root = await mkdtemp(join(tmpdir(), 'external-source-publish-'));
  const planned = planEnqueuePaths(root, 'questions', 'lote.json');

  await publishAtomically(
    planned.outputPath,
    planned.manifestPath,
    new TextEncoder().encode('{"questions":[]}'),
    '{"schemaVersion":1,"sha256":"abc"}\n',
  );

  assert.equal(await readFile(planned.outputPath, 'utf8'), '{"questions":[]}');
  assert.equal(await readFile(planned.manifestPath, 'utf8'), '{"schemaVersion":1,"sha256":"abc"}\n');
});

test('grava e lê publicação incremental com base de uso preservada', async () => {
  const root = await mkdtemp(join(tmpdir(), 'external-source-latest-'));
  const latestPath = join(root, 'metadata', 'questions', 'prova.latest.json');
  const expected = {
    schemaVersion: 1 as const,
    sequence: 3,
    sha256: 'b'.repeat(64),
    output: join(root, 'questions', 'lote.json'),
    manifest: join(root, 'metadata', 'questions', 'lote.json.source.json'),
    usageBasis: 'official' as const,
  };

  assert.equal(await readLatestPublication(latestPath), null);
  await writeLatestPublication(latestPath, expected);
  assert.deepEqual(await readLatestPublication(latestPath), expected);
});

test('rejeita marcador incremental com base de uso inválida', async () => {
  const root = await mkdtemp(join(tmpdir(), 'external-source-latest-invalid-usage-'));
  const latestPath = join(root, 'metadata', 'questions', 'prova.latest.json');
  await mkdir(join(root, 'metadata', 'questions'), { recursive: true });
  await writeFile(latestPath, JSON.stringify({
    schemaVersion: 1,
    sequence: 1,
    sha256: 'c'.repeat(64),
    output: join(root, 'questions', 'lote.json'),
    manifest: join(root, 'metadata', 'questions', 'lote.json.source.json'),
    usageBasis: 'unknown',
  }));

  await assert.rejects(
    readLatestPublication(latestPath),
    /Marcador de publicação incremental inválido/,
  );
});

test('serializa duas publicações concorrentes do mesmo prefixo sem exigir ordem de aquisição', async () => {
  const root = await mkdtemp(join(tmpdir(), 'external-source-lock-'));
  const lockPath = join(root, 'metadata', 'questions', 'prova.latest.lock');
  const events: string[] = [];

  await Promise.all([
    withPublicationLock(lockPath, async () => {
      events.push('a:start');
      await new Promise((resolve) => setTimeout(resolve, 80));
      events.push('a:end');
    }),
    withPublicationLock(lockPath, async () => {
      events.push('b:start');
      events.push('b:end');
    }),
  ]);

  const observed = events.join(',');
  assert.ok(
    observed === 'a:start,a:end,b:start,b:end' || observed === 'b:start,b:end,a:start,a:end',
    `esperava seções críticas serializadas, recebeu: ${observed}`,
  );
});

test('rejeita nome já publicado sem sobrescrever lote nem manifesto existentes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'external-source-publish-duplicate-'));
  const planned = planEnqueuePaths(root, 'questions', 'lote.json');

  await publishAtomically(
    planned.outputPath,
    planned.manifestPath,
    new TextEncoder().encode('{"questions":[{"id":"original"}]}'),
    '{"schemaVersion":1,"sha256":"original"}\n',
  );

  await assert.rejects(
    publishAtomically(
      planned.outputPath,
      planned.manifestPath,
      new TextEncoder().encode('{"questions":[{"id":"novo"}]}'),
      '{"schemaVersion":1,"sha256":"novo"}\n',
    ),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'EEXIST',
  );

  assert.equal(await readFile(planned.outputPath, 'utf8'), '{"questions":[{"id":"original"}]}');
  assert.equal(await readFile(planned.manifestPath, 'utf8'), '{"schemaVersion":1,"sha256":"original"}\n');
});
