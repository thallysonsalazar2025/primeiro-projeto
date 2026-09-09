import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BNDES_2024_SOURCE_URL,
  fetchBndes2024DevelopmentDocuments,
  selectBndes2024DevelopmentDocuments,
} from './bndes-2024-source.ts';
import type { OfficialDocumentCandidate } from './official-document-discovery.ts';

const PUBLIC_IP = async () => ['200.20.10.1'];
const EXAM_URL = 'https://www.bndes.gov.br/docs/Objetiva%20-%20AN%C3%81LISE%20DE%20SISTEMAS%20-%20DESENVOLVIMENTO.pdf';
const KEY_URL = 'https://www.bndes.gov.br/docs/Gabarito%20Final%20-%20ap%C3%B3s%20avalia%C3%A7%C3%A3o%20dos%20recursos.pdf';

function candidate(documentUrl: string): OfficialDocumentCandidate {
  return { sourceUrl: BNDES_2024_SOURCE_URL, documentUrl, documentType: 'pdf' };
}

test('seleciona de forma determinística prova de desenvolvimento e gabarito final', () => {
  const selection = selectBndes2024DevelopmentDocuments([
    candidate('https://www.bndes.gov.br/docs/Objetiva%20-%20ADMINISTRACAO.pdf'),
    candidate(KEY_URL),
    candidate(EXAM_URL),
  ]);

  assert.equal(selection.exam.documentUrl, EXAM_URL);
  assert.equal(selection.answerKey.documentUrl, KEY_URL);
});

test('falha fechado quando o catálogo torna a seleção ambígua', () => {
  assert.throws(
    () => selectBndes2024DevelopmentDocuments([
      candidate(EXAM_URL),
      candidate('https://www.bndes.gov.br/outro/Objetiva%20-%20ANALISE%20DE%20SISTEMAS%20-%20DESENVOLVIMENTO.pdf'),
      candidate(KEY_URL),
    ]),
    /esperado exatamente 1 caderno objetivo/i,
  );
});

test('busca catálogo, baixa prova e gabarito e preserva a cadeia de proveniência', async () => {
  const seen: string[] = [];
  const html = `<html><body>
    <a href="${EXAM_URL}">Análise de sistemas - Desenvolvimento</a>
    <a href="${KEY_URL}">Gabarito final</a>
  </body></html>`;

  const fetchImpl = async (input: string | URL) => {
    const url = input.toString();
    seen.push(url);
    if (url === BNDES_2024_SOURCE_URL) {
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    if (url === EXAM_URL || url === KEY_URL) {
      return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, url === EXAM_URL ? 0x31 : 0x32]), {
        headers: { 'content-type': 'application/pdf' },
      });
    }
    return new Response('not found', { status: 404 });
  };

  const result = await fetchBndes2024DevelopmentDocuments({
    fetchImpl,
    resolveHost: PUBLIC_IP,
    now: () => new Date('2026-09-09T22:30:00.000Z'),
  });

  assert.deepEqual(seen, [BNDES_2024_SOURCE_URL, EXAM_URL, KEY_URL]);
  assert.equal(result.catalog.sourceUrl, BNDES_2024_SOURCE_URL);
  assert.equal(result.exam.manifest.sourceUrl, BNDES_2024_SOURCE_URL);
  assert.equal(result.exam.manifest.documentUrl, EXAM_URL);
  assert.equal(result.exam.manifest.finalUrl, EXAM_URL);
  assert.equal(result.exam.manifest.usageBasis, 'official-publication');
  assert.equal(result.answerKey.manifest.documentUrl, KEY_URL);
  assert.equal(result.answerKey.manifest.finalUrl, KEY_URL);
  assert.match(result.exam.manifest.sha256, /^[a-f0-9]{64}$/);
  assert.notEqual(result.exam.manifest.sha256, result.answerKey.manifest.sha256);
});
