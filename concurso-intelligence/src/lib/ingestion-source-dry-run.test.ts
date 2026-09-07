import assert from 'node:assert/strict';
import test from 'node:test';
import { formatIngestionDryRun } from './ingestion-source-dry-run.ts';

test('dry-run lista somente fontes habilitadas sem expor URL', () => {
  const lines = formatIngestionDryRun([
    {
      id: 'questions-a',
      url: 'https://example.com/questions?token=secret',
      enqueue: 'questions',
      namePrefix: 'questions-a',
      expectedSha256: 'a'.repeat(64),
      usageBasis: 'official',
      enabled: true,
    },
    {
      id: 'rankings-b',
      url: 'https://example.com/rankings?token=hidden',
      enqueue: 'rankings',
      namePrefix: 'rankings-b',
      usageBasis: 'licensed',
      enabled: false,
    },
  ]);

  assert.deepEqual(lines, [
    '[ingestion:sources] dry-run válido: 1 habilitada(s), 1 desabilitada(s).',
    '[ingestion:sources] pronta: questions-a -> questions/questions-a (uso: official, SHA-256 fixado)',
  ]);
  assert.equal(lines.join('\n').includes('example.com'), false);
  assert.equal(lines.join('\n').includes('secret'), false);
  assert.equal(lines.join('\n').includes('hidden'), false);
  assert.equal(lines.join('\n').includes('licensed'), false);
});

test('dry-run exibe base de uso e não marca SHA como fixado quando ausente', () => {
  const lines = formatIngestionDryRun([
    {
      id: 'questions-a',
      url: 'https://example.com/questions',
      enqueue: 'questions',
      namePrefix: 'questions-a',
      usageBasis: 'open-data',
      enabled: true,
    },
  ]);

  assert.deepEqual(lines, [
    '[ingestion:sources] dry-run válido: 1 habilitada(s), 0 desabilitada(s).',
    '[ingestion:sources] pronta: questions-a -> questions/questions-a (uso: open-data)',
  ]);
});
