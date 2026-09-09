import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverOfficialDocumentCandidates } from './official-document-discovery.ts';

function html(value: string) {
  return new TextEncoder().encode(value);
}

test('descobre documentos relativos oficiais e remove duplicados', () => {
  const result = discoverOfficialDocumentCandidates(
    html('<a href="/provas/analise.pdf">Prova</a><a href="/provas/analise.pdf">Duplicada</a><a href="/gabaritos/analise.pdf">Gabarito</a>'),
    'https://www.gov.br/gestao/catalogo',
    { allowedTypes: ['pdf'] },
  );

  assert.deepEqual(result, [
    {
      sourceUrl: 'https://www.gov.br/gestao/catalogo',
      documentUrl: 'https://www.gov.br/provas/analise.pdf',
      documentType: 'pdf',
    },
    {
      sourceUrl: 'https://www.gov.br/gestao/catalogo',
      documentUrl: 'https://www.gov.br/gabaritos/analise.pdf',
      documentType: 'pdf',
    },
  ]);
});

test('ignora host fora da allowlist, HTTP e parâmetros sensíveis', () => {
  const result = discoverOfficialDocumentCandidates(
    html([
      '<a href="https://evil.example/prova.pdf">fora</a>',
      '<a href="http://www.gov.br/prova.pdf">http</a>',
      '<a href="https://www.gov.br/prova.pdf?access_token=segredo">token</a>',
      '<a href="https://cdn.gov.br/prova.pdf">cdn permitido</a>',
    ].join('')),
    'https://www.gov.br/catalogo',
    { allowedHosts: ['www.gov.br', 'cdn.gov.br'], allowedTypes: ['pdf'] },
  );

  assert.deepEqual(result.map((candidate) => candidate.documentUrl), ['https://cdn.gov.br/prova.pdf']);
});

test('filtra por tipo permitido e resolve href com entidade HTML', () => {
  const result = discoverOfficialDocumentCandidates(
    html('<a href="/dados/prova.csv?versao=1&amp;formato=aberto">CSV</a><a href="/arquivo.zip">ZIP</a>'),
    'https://dadosabertos.go.gov.br/dataset/concurso',
    { allowedTypes: ['csv'] },
  );

  assert.equal(result.length, 1);
  assert.equal(result[0]?.documentType, 'csv');
  assert.equal(result[0]?.documentUrl, 'https://dadosabertos.go.gov.br/dados/prova.csv?versao=1&formato=aberto');
});

test('falha fechado para HTML com UTF-8 inválido', () => {
  assert.throws(
    () => discoverOfficialDocumentCandidates(
      new Uint8Array([0xc3, 0x28]),
      'https://www.gov.br/catalogo',
    ),
    /UTF-8 válido/,
  );
});
