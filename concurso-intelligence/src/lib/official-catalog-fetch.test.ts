import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchOfficialCatalogCandidates } from './official-catalog-fetch.ts';

const PUBLIC_IP = async () => ['93.184.216.34'];

test('resolve links relativos contra a URL final do catálogo sem perder sourceUrl original', async () => {
  const seen: string[] = [];
  const fetchImpl = async (input: string | URL) => {
    const url = input.toString();
    seen.push(url);
    if (url === 'https://www.gov.br/catalogo') {
      return new Response(null, {
        status: 302,
        headers: { location: 'https://cdn.gov.br/publicacoes/' },
      });
    }
    if (url === 'https://cdn.gov.br/publicacoes/') {
      return new Response('<a href="prova.pdf">Prova</a>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }
    return new Response('not found', { status: 404 });
  };

  const result = await fetchOfficialCatalogCandidates(
    'https://www.gov.br/catalogo',
    {
      allowedHosts: ['www.gov.br', 'cdn.gov.br'],
      allowedTypes: ['pdf'],
      fetchImpl,
      resolveHost: PUBLIC_IP,
      now: () => new Date('2026-09-09T20:30:00.000Z'),
    },
  );

  assert.deepEqual(seen, [
    'https://www.gov.br/catalogo',
    'https://cdn.gov.br/publicacoes/',
  ]);
  assert.equal(result.sourceUrl, 'https://www.gov.br/catalogo');
  assert.equal(result.finalUrl, 'https://cdn.gov.br/publicacoes/');
  assert.equal(result.candidates[0]?.sourceUrl, 'https://www.gov.br/catalogo');
  assert.equal(result.candidates[0]?.documentUrl, 'https://cdn.gov.br/publicacoes/prova.pdf');
});

test('rejeita catálogo que não retorna HTML', async () => {
  const fetchImpl = async () => new Response('%PDF', {
    status: 200,
    headers: { 'content-type': 'application/pdf' },
  });

  await assert.rejects(
    fetchOfficialCatalogCandidates('https://www.gov.br/catalogo', {
      allowedHosts: ['www.gov.br'],
      fetchImpl,
      resolveHost: PUBLIC_IP,
    }),
    /Catálogo oficial deve ser HTML/,
  );
});

test('propaga allowlist para redirects do catálogo', async () => {
  const fetchImpl = async () => new Response(null, {
    status: 302,
    headers: { location: 'https://evil.example/catalogo' },
  });

  await assert.rejects(
    fetchOfficialCatalogCandidates('https://www.gov.br/catalogo', {
      allowedHosts: ['www.gov.br'],
      fetchImpl,
      resolveHost: PUBLIC_IP,
    }),
    /host fora da allowlist/i,
  );
});
