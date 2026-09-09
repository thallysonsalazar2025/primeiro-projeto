import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseIngestionSourceRegistry, requireIngestionUsageBasis } from './ingestion-source-registry.ts';

test('aceita registry HTTPS válido com ativação explícita', () => {
  const registry = parseIngestionSourceRegistry({
    schemaVersion: 1,
    sources: [
      {
        id: 'fonte-oficial',
        url: 'https://example.gov.br/questions.json',
        enqueue: 'questions',
        namePrefix: 'fonte-oficial',
        usageBasis: 'official',
        enabled: true,
      },
    ],
  });

  assert.equal(registry.sources[0]?.enabled, true);
  assert.equal(registry.sources[0]?.usageBasis, 'official');
  assert.equal(registry.sources[0]?.url, 'https://example.gov.br/questions.json');
});

test('exige base de uso quando o fluxo precisa publicar conteúdo externo', () => {
  assert.equal(requireIngestionUsageBasis('official', '--usage-basis'), 'official');
  assert.equal(requireIngestionUsageBasis('open-data', '--usage-basis'), 'open-data');
  assert.equal(requireIngestionUsageBasis('licensed', '--usage-basis'), 'licensed');
  assert.throws(() => requireIngestionUsageBasis(undefined, '--usage-basis'), /--usage-basis é obrigatório/);
  assert.throws(() => requireIngestionUsageBasis('unknown', '--usage-basis'), /official, open-data ou licensed/);
});

test('mantém fonte desabilitada quando enabled é omitido', () => {
  const registry = parseIngestionSourceRegistry({
    schemaVersion: 1,
    sources: [
      {
        id: 'fonte-em-preparacao',
        url: 'https://example.gov.br/questions.json',
        enqueue: 'questions',
        namePrefix: 'fonte-em-preparacao',
        usageBasis: 'official',
      },
    ],
  });

  assert.equal(registry.sources[0]?.enabled, false);
});

test('rejeita fonte sem HTTPS', () => {
  assert.throws(
    () => parseIngestionSourceRegistry({
      schemaVersion: 1,
      sources: [{ id: 'x', url: 'http://example.com/a.json', enqueue: 'questions', namePrefix: 'x', usageBasis: 'official' }],
    }),
    /HTTPS/,
  );
});

test('rejeita hosts locais ou privados no registry de ingestão', () => {
  for (const url of [
    'https://localhost/questions.json',
    'https://127.0.0.1/questions.json',
    'https://10.0.0.7/questions.json',
    'https://192.168.1.10/questions.json',
    'https://[::1]/questions.json',
  ]) {
    assert.throws(
      () => parseIngestionSourceRegistry({
        schemaVersion: 1,
        sources: [{ id: 'x', url, enqueue: 'questions', namePrefix: 'x', usageBasis: 'official' }],
      }),
      /host local ou privado/,
    );
  }
});

test('rejeita credenciais e parâmetros sensíveis em URL de fonte', () => {
  for (const url of [
    'https://user:password@example.com/questions.json',
    'https://example.com/questions.json?access_token=secret',
    'https://example.com/questions.json?clientSecret=secret',
  ]) {
    assert.throws(
      () => parseIngestionSourceRegistry({
        schemaVersion: 1,
        sources: [{ id: 'x', url, enqueue: 'questions', namePrefix: 'x', usageBasis: 'official' }],
      }),
      /credenciais embutidas|parâmetro sensível/,
    );
  }
});

test('rejeita ids e prefixos de fila duplicados', () => {
  assert.throws(
    () => parseIngestionSourceRegistry({
      schemaVersion: 1,
      sources: [
        { id: 'a', url: 'https://example.com/a.json', enqueue: 'questions', namePrefix: 'lote', usageBasis: 'official' },
        { id: 'b', url: 'https://example.com/b.json', enqueue: 'questions', namePrefix: 'lote', usageBasis: 'official' },
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
        { id: 'a', url: 'https://example.com/a.json', enqueue: 'questions', namePrefix: 'Fonte', usageBasis: 'official' },
        { id: 'b', url: 'https://example.com/b.json', enqueue: 'questions', namePrefix: 'fonte', usageBasis: 'official' },
      ],
    }),
    /Prefixo duplicado/,
  );
});

test('limita namePrefix ao contrato de 64 caracteres do publisher', () => {
  assert.doesNotThrow(() => parseIngestionSourceRegistry({
    schemaVersion: 1,
    sources: [{ id: 'a', url: 'https://example.com/a.json', enqueue: 'questions', namePrefix: 'a'.repeat(64), usageBasis: 'official' }],
  }));

  assert.throws(
    () => parseIngestionSourceRegistry({
      schemaVersion: 1,
      sources: [{ id: 'a', url: 'https://example.com/a.json', enqueue: 'questions', namePrefix: 'a'.repeat(65), usageBasis: 'official' }],
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
          usageBasis: 'official',
        },
      ],
    }),
    /SHA-256/,
  );
});

test('exige base de uso válida para toda fonte explicitamente habilitada', () => {
  assert.throws(
    () => parseIngestionSourceRegistry({
      schemaVersion: 1,
      sources: [{ id: 'a', url: 'https://example.com/a.json', enqueue: 'questions', namePrefix: 'a', enabled: true }],
    }),
    /usageBasis é obrigatório/,
  );

  assert.throws(
    () => parseIngestionSourceRegistry({
      schemaVersion: 1,
      sources: [{ id: 'a', url: 'https://example.com/a.json', enqueue: 'questions', namePrefix: 'a', usageBasis: 'unknown', enabled: true }],
    }),
    /official, open-data ou licensed/,
  );

  for (const usageBasis of ['official', 'open-data', 'licensed']) {
    assert.doesNotThrow(() => parseIngestionSourceRegistry({
      schemaVersion: 1,
      sources: [{ id: usageBasis, url: 'https://example.com/a.json', enqueue: 'questions', namePrefix: usageBasis, usageBasis, enabled: true }],
    }));
  }
});

test('permite fonte desabilitada sem base de uso enquanto ainda está em preparação', () => {
  const registry = parseIngestionSourceRegistry({
    schemaVersion: 1,
    sources: [{ id: 'draft', url: 'https://example.com/a.json', enqueue: 'questions', namePrefix: 'draft', enabled: false }],
  });

  assert.equal(registry.sources[0]?.enabled, false);
  assert.equal(registry.sources[0]?.usageBasis, undefined);
});

test('mantém o registry de exemplo sincronizado com o parser e seguro por padrão', async () => {
  const raw = await readFile(new URL('../../config/ingestion-sources.example.json', import.meta.url), 'utf8');
  const registry = parseIngestionSourceRegistry(JSON.parse(raw));

  assert.equal(registry.schemaVersion, 1);
  assert.ok(registry.sources.length >= 2);
  assert.ok(registry.sources.every((source) => source.enabled === false));
  assert.ok(registry.sources.every((source) => source.usageBasis === 'official'));
  assert.ok(registry.sources.some((source) => source.enqueue === 'questions'));
  assert.ok(registry.sources.some((source) => source.enqueue === 'rankings'));
});
