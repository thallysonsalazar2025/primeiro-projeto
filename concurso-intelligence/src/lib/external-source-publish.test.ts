import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  contentAddressedEnqueueName,
  hasPublishedSha,
  planEnqueuePaths,
  publishAtomically,
} from './external-source-publish.ts';

test('gera nome determinístico por prefixo e SHA-256', () => {
  const sha = 'A'.repeat(64);
  assert.equal(contentAddressedEnqueueName('prova-sefaz-2026', sha), 'prova-sefaz-2026-aaaaaaaaaaaa.json');
});

test('rejeita prefixo inseguro ou SHA-256 inválido', () => {
  assert.throws(() => contentAddressedEnqueueName('../prova', 'a'.repeat(64)), /Prefixo do lote/);
  assert.throws(() => contentAddressedEnqueueName('prova', 'abc'), /SHA-256 inválido/);
});

test('planeja lote na fila e manifesto fora do diretório observado pelo worker', () => {
  const planned = planEnqueuePaths('/imports', 'questions', 'prova-2026.json');
  assert.equal(planned.outputPath, '/imports/questions/prova-2026.json');
  assert.equal(planned.manifestPath, '/imports/metadata/questions/prova-2026.json.source.json');
});

test('rejeita nome de lote com path traversal ou extensão diferente de json', () => {
  assert.throws(() => planEnqueuePaths('/imports', 'questions', '../evil.json'), /arquivo .json sem diretórios/);
  assert.throws(() => planEnqueuePaths('/imports', 'questions', 'lote.txt'), /arquivo .json sem diretórios/);
});

test('publica manifesto e lote sem deixar arquivo parcial visível', async () => {
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
  assert.equal(await hasPublishedSha(planned.manifestPath, 'ABC'), true);
});

test('informa false quando ainda não existe manifesto', async () => {
  const root = await mkdtemp(join(tmpdir(), 'external-source-publish-missing-'));
  assert.equal(await hasPublishedSha(join(root, 'missing.source.json'), 'a'.repeat(64)), false);
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
