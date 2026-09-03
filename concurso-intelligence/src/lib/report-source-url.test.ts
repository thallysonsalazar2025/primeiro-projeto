import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeReportSourceUrl } from './report-source-url.ts';

test('remove query string, fragment and credentials from provenance URL', () => {
  assert.equal(
    sanitizeReportSourceUrl('https://user:secret@example.gov.br/provas/edital.pdf?token=abc#pagina-2'),
    'https://example.gov.br/provas/edital.pdf',
  );
});

test('preserves safe HTTP(S) origin and path', () => {
  assert.equal(
    sanitizeReportSourceUrl('http://example.gov.br/arquivo.pdf'),
    'http://example.gov.br/arquivo.pdf',
  );
});

test('rejects non HTTP(S) provenance URLs', () => {
  assert.throws(
    () => sanitizeReportSourceUrl('file:///tmp/prova.pdf'),
    /HTTP ou HTTPS/,
  );
});
