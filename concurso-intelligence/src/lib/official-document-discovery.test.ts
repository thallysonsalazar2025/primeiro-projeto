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

test('filtra por tipo permitido e resolve href com entidades HTML numéricas', () => {
  const result = discoverOfficialDocumentCandidates(
    html('<a href="/dados/prova&#46;csv?versao=1&#38;formato=aberto">CSV</a><a href="/arquivo.zip">ZIP</a>'),
    'https://dadosabertos.go.gov.br/dataset/concurso',
    { allowedTypes: ['csv'] },
  );

  assert.equal(result.length, 1);
  assert.equal(result[0]?.documentType, 'csv');
  assert.equal(result[0]?.documentUrl, 'https://dadosabertos.go.gov.br/dados/prova.csv?versao=1&formato=aberto');
});

test('usa somente o atributo href exato e não data-href', () => {
  const result = discoverOfficialDocumentCandidates(
    html('<a href="/real.pdf" data-href="/preview.pdf">Prova</a>'),
    'https://www.gov.br/catalogo',
    { allowedTypes: ['pdf'] },
  );
  assert.deepEqual(result.map((candidate) => candidate.documentUrl), ['https://www.gov.br/real.pdf']);
});

test('honra o primeiro base HTTPS permitido para links relativos', () => {
  const result = discoverOfficialDocumentCandidates(
    html('<base href="https://cdn.gov.br/files/"><a href="exam.pdf">Prova</a>'),
    'https://www.gov.br/catalogo/',
    { allowedHosts: ['www.gov.br', 'cdn.gov.br'], allowedTypes: ['pdf'] },
  );
  assert.deepEqual(result.map((candidate) => candidate.documentUrl), ['https://cdn.gov.br/files/exam.pdf']);
});

test('remove fragmentos antes da deduplicação', () => {
  const result = discoverOfficialDocumentCandidates(
    html('<a href="/prova.pdf#page=1">p1</a><a href="/prova.pdf#page=20">p20</a>'),
    'https://www.gov.br/catalogo',
    { allowedTypes: ['pdf'] },
  );
  assert.deepEqual(result.map((candidate) => candidate.documentUrl), ['https://www.gov.br/prova.pdf']);
});

test('não degrada quadraticamente com tags malformadas sem fechamento', () => {
  const malformed = '<a href="x"'.repeat(10_000);
  const startedAt = Date.now();
  const result = discoverOfficialDocumentCandidates(html(malformed), 'https://www.gov.br/catalogo');
  assert.deepEqual(result, []);
  assert.ok(Date.now() - startedAt < 1_000);
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


test('decodifica entidades HTML nomeadas em href oficial', () => {
  const result = discoverOfficialDocumentCandidates(
    html('<a href="/provas&sol;analise&period;pdf">Prova</a>'),
    'https://www.gov.br/catalogo',
    { allowedTypes: ['pdf'] },
  );
  assert.deepEqual(result.map((candidate) => candidate.documentUrl), ['https://www.gov.br/provas/analise.pdf']);
});
