import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConfiguredIngestionSource } from './ingestion-source-registry.ts';
import { runConfiguredIngestionSources } from './ingestion-source-runner.ts';

const source = (id: string, enabled = true): ConfiguredIngestionSource => ({
  id,
  url: `https://example.com/${id}.json`,
  enqueue: 'questions',
  namePrefix: id,
  enabled,
});

test('continua fontes posteriores e agrega falhas individuais', async () => {
  const visited: string[] = [];
  const result = await runConfiguredIngestionSources(
    [source('primeira'), source('segunda'), source('terceira')],
    async (current) => {
      visited.push(current.id);
      if (current.id === 'primeira') throw new Error('falha transitória');
    },
  );

  assert.deepEqual(visited, ['primeira', 'segunda', 'terceira']);
  assert.equal(result.attempted, 3);
  assert.equal(result.succeeded, 2);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0]?.id, 'primeira');
  assert.match(result.failures[0]?.error.message ?? '', /falha transitória/);
});

test('ignora fontes desabilitadas', async () => {
  const visited: string[] = [];
  const result = await runConfiguredIngestionSources(
    [source('ativa'), source('desligada', false)],
    async (current) => {
      visited.push(current.id);
    },
  );

  assert.deepEqual(visited, ['ativa']);
  assert.equal(result.attempted, 1);
  assert.equal(result.succeeded, 1);
  assert.equal(result.failures.length, 0);
});
