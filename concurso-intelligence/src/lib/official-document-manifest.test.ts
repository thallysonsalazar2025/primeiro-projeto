import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOfficialDocumentManifest } from './official-document-manifest.ts';

function validManifest() {
  return {
    schemaVersion: 1 as const,
    sourceUrl: 'https://www.gov.br/catalogo',
    documentUrl: 'https://www.gov.br/provas/prova.pdf',
    finalUrl: 'https://cdn.gov.br/provas/prova.pdf',
    documentType: 'pdf' as const,
    usageBasis: 'official-publication' as const,
    license: null,
    termsUrl: null,
    retrievedAt: '2026-09-09T12:00:00-03:00',
    sha256: 'A'.repeat(64),
    contentType: 'application/pdf',
    bytes: 1024,
  };
}

test('preserva cadeia de proveniência e normaliza sha256', () => {
  const parsed = parseOfficialDocumentManifest(validManifest());

  assert.equal(parsed.sourceUrl, 'https://www.gov.br/catalogo');
  assert.equal(parsed.documentUrl, 'https://www.gov.br/provas/prova.pdf');
  assert.equal(parsed.finalUrl, 'https://cdn.gov.br/provas/prova.pdf');
  assert.equal(parsed.sha256, 'a'.repeat(64));
});

test('rejeita URLs não HTTPS no manifesto bruto', () => {
  assert.throws(() => parseOfficialDocumentManifest({
    ...validManifest(),
    finalUrl: 'http://127.0.0.1/prova.pdf',
  }));
});

test('rejeita open-data sem licença explícita', () => {
  assert.throws(() => parseOfficialDocumentManifest({
    ...validManifest(),
    usageBasis: 'open-data',
    license: null,
    termsUrl: 'https://dados.gov.br/termos',
  }));
});

test('aceita open-data com licença auditável', () => {
  const parsed = parseOfficialDocumentManifest({
    ...validManifest(),
    usageBasis: 'open-data',
    license: 'CC BY 4.0',
    termsUrl: 'https://creativecommons.org/licenses/by/4.0/',
  });

  assert.equal(parsed.license, 'CC BY 4.0');
});

test('rejeita sha256 inválido e tamanho vazio', () => {
  assert.throws(() => parseOfficialDocumentManifest({
    ...validManifest(),
    sha256: '1234',
  }));
  assert.throws(() => parseOfficialDocumentManifest({
    ...validManifest(),
    bytes: 0,
  }));
});
