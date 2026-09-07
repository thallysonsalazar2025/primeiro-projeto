import assert from 'node:assert/strict';
import test from 'node:test';
import { parseIngestionSourceRegistry } from './ingestion-source-registry.ts';

test('aceita registry HTTPS válido e normaliza defaults', () => {
  const registry = parseIngestionSourceRegistry({
    schemaVersion: 1,
    sources: [
      {
        id: 'fonte-oficial',
        url: 'https://example.gov.br/questions.json',
        enqueue: 'questions',
        namePrefix: 'fonte-oficial',
      },
    ],
  });

  assert.equal(registry.sources[0]?.enabled, true);
  assert.equal(registry.sources[0]?.url, 'https://example.gov.br/questions.json');
});

test('rejeita fonte sem HTTPS', () => {
  assert.throws(
    () => parseIngestionSourceRegistry({
      schemaVersion: 1,
      sources: [{ id: 'x', url: 'http://example.com/a.json', enqueue: 'questions', namePrefix: 'x' }],
    }),
    /HTTPS/,
  );
});

test('rejeita ids e prefixos de fila duplicados', () => {
  assert.throws(
    () => parseIngestionSourceRegistry({
      schemaVersion: 1,
      sources: [
        { id: 'a', url: 'https://example.com/a.json', enqueue: 'questions', namePrefix: 'lote' },
        { id: 'b', url: 'https://example.com/b.json', enqueue: 'questions', namePrefix: 'lote' },
      ],
    }),
    /Prefixo duplicado/,
  );
});

test('valida SHA-256 opcional', () => {
  assert.throws(
    () => parseIngestionSourceRegistry({
      schemaVersion: 1,
      sources: [
        {
          id: 'a',
          url: 'https://example.com/a.json',
          enqueue: 'rankings',
          namePrefix: 'ranking-a',
          expectedSha256: 'abc',
        },
      ],
    }),
    /SHA-256/,
  );
});
