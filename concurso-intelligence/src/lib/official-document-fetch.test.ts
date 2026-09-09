import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchOfficialDocument } from './official-document-fetch.ts';

function baseInput() {
  return {
    sourceUrl: 'https://www.gov.br/catalogo',
    documentUrl: 'https://www.gov.br/provas/prova.pdf',
    documentType: 'pdf' as const,
    usageBasis: 'official-publication' as const,
    license: null,
    termsUrl: null,
  };
}

test('baixa documento oficial e produz manifesto auditável', async () => {
  const result = await fetchOfficialDocument(baseInput(), {
    fetchImpl: async () => new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    }),
    now: () => new Date('2026-09-09T17:00:00.000Z'),
  });

  assert.deepEqual(Array.from(result.bytes), [1, 2, 3]);
  assert.equal(result.manifest.sourceUrl, 'https://www.gov.br/catalogo');
  assert.equal(result.manifest.documentUrl, 'https://www.gov.br/provas/prova.pdf');
  assert.equal(result.manifest.finalUrl, 'https://www.gov.br/provas/prova.pdf');
  assert.equal(result.manifest.documentType, 'pdf');
  assert.equal(result.manifest.contentType, 'application/pdf');
  assert.equal(result.manifest.bytes, 3);
  assert.equal(result.manifest.retrievedAt, '2026-09-09T17:00:00.000Z');
  assert.match(result.manifest.sha256, /^[a-f0-9]{64}$/);
});

test('falha fechado quando o servidor entrega mídia incompatível', async () => {
  await assert.rejects(
    () => fetchOfficialDocument(baseInput(), {
      fetchImpl: async () => new Response('<html>erro</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    }),
    /contentType incompatível/,
  );
});

test('preserva finalUrl depois de redirect seguro', async () => {
  let calls = 0;
  const result = await fetchOfficialDocument(baseInput(), {
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://cdn.gov.br/provas/prova.pdf' },
        });
      }
      return new Response(new Uint8Array([9]), {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      });
    },
  });

  assert.equal(result.manifest.finalUrl, 'https://cdn.gov.br/provas/prova.pdf');
  assert.equal(result.manifest.documentUrl, 'https://www.gov.br/provas/prova.pdf');
});
