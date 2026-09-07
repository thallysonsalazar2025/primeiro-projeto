import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('rejeita prefixos que colidem apenas por caixa', () => {
  assert.throws(
    () => parseIngestionSourceRegistry({
      schemaVersion: 1,
      sources: [
        { id: 'a', url: 'https://example.com/a.json', enqueue: 'questions', namePrefix: 'Fonte' },
        { id: 'b', url: 'https://example.com/b.json', enqueue: 'questions', namePrefix: 'fonte' },
      ],
    }),
    /Prefixo duplicado/,
  );
});

test('limita namePrefix ao contrato de 64 caracteres do publisher', () => {
  assert.doesNotThrow(() => parseIngestionSourceRegistry({
    schemaVersion: 1,
    sources: [{ id: 'a', url: 'https://example.com/a.json', enqueue: 'questions', namePrefix: 'a'.repeat(64) }],
  }));

  assert.throws(
    () => parseIngestionSourceRegistry({
      schemaVersion: 1,
      sources: [{ id: 'a', url: 'https://example.com/a.json', enqueue: 'questions', namePrefix: 'a'.repeat(65) }],
    }),
    /até 64 caracteres/,
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

test('mantém o registry de exemplo sincronizado com o parser e seguro por padrão', async () => {
  const raw = await readFile(new URL('../../config/ingestion-sources.example.json', import.meta.url), 'utf8');
  const registry = parseIngestionSourceRegistry(JSON.parse(raw));

  assert.equal(registry.schemaVersion, 1);
  assert.ok(registry.sources.length >= 2);
  assert.ok(registry.sources.every((source) => source.enabled === false));
  assert.ok(registry.sources.some((source) => source.enqueue === 'questions'));
  assert.ok(registry.sources.some((source) => source.enqueue === 'rankings'));
});
