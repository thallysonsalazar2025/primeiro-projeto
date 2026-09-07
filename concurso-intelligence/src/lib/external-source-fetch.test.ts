import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchExternalSource } from './external-source-fetch.ts';

function response(body: string, init: ResponseInit & { url?: string } = {}) {
  const result = new Response(body, init);
  Object.defineProperty(result, 'url', { value: init.url ?? 'https://example.org/final.json' });
  return result;
}

test('baixa fonte HTTPS e registra hash/data auditáveis', async () => {
  const result = await fetchExternalSource('https://example.org/source.json', {
    fetchImpl: async () => response('abc', {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-length': '3' },
    }),
    now: () => new Date('2026-09-07T02:30:00.000Z'),
  });

  assert.equal(Buffer.from(result.bytes).toString('utf8'), 'abc');
  assert.equal(result.sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(result.retrievedAt, '2026-09-07T02:30:00.000Z');
  assert.equal(result.contentType, 'application/json');
});

test('rejeita protocolo não HTTPS e localhost', async () => {
  await assert.rejects(() => fetchExternalSource('http://example.org/a'), /HTTPS/);
  await assert.rejects(() => fetchExternalSource('https://localhost/a'), /localhost/);
});

test('rejeita resposta HTTP sem sucesso', async () => {
  await assert.rejects(
    () => fetchExternalSource('https://example.org/a', {
      fetchImpl: async () => response('nope', { status: 404 }),
    }),
    /HTTP 404/,
  );
});

test('rejeita fonte acima do limite pelo header ou pelos bytes reais', async () => {
  await assert.rejects(
    () => fetchExternalSource('https://example.org/a', {
      maxBytes: 2,
      fetchImpl: async () => response('abc', { headers: { 'content-length': '3' } }),
    }),
    /excede o limite/,
  );

  await assert.rejects(
    () => fetchExternalSource('https://example.org/a', {
      maxBytes: 2,
      fetchImpl: async () => response('abc'),
    }),
    /excede o limite/,
  );
});

test('valida SHA-256 esperado quando informado', async () => {
  const valid = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  const ok = await fetchExternalSource('https://example.org/a', {
    expectedSha256: valid,
    fetchImpl: async () => response('abc'),
  });
  assert.equal(ok.sha256, valid);

  await assert.rejects(
    () => fetchExternalSource('https://example.org/a', {
      expectedSha256: '0'.repeat(64),
      fetchImpl: async () => response('abc'),
    }),
    /SHA-256 divergente/,
  );
});
