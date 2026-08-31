import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNoDuplicateRankingRows, parseOfficialRankingImport } from './official-ranking-import.ts';

test('valida payload oficial, normaliza chave e aplica categoria geral por padrão', () => {
  const payload = parseOfficialRankingImport({
    contestId: 'contest-1',
    positionId: 'position-1',
    sourceUrl: 'https://example.gov.br/resultado.pdf',
    sourcePage: 3,
    rows: [{ candidateKey: ' candidate-1 ', score: 82.5, rank: 4, sourcePage: 7 }],
  });

  assert.equal(payload.rows[0].candidateKey, 'candidate-1');
  assert.equal(payload.rows[0].category, 'GENERAL');
  assert.equal(payload.rows[0].sourcePage, 7);
  assert.doesNotThrow(() => assertNoDuplicateRankingRows(payload));
});

test('rejeita candidateKey vazio após trim', () => {
  assert.throws(() => parseOfficialRankingImport({
    contestId: 'contest-1',
    sourceUrl: 'https://example.gov.br/resultado.pdf',
    rows: [{ candidateKey: '   ', score: 82.5 }],
  }));
});

test('rejeita duplicidade de candidato dentro da mesma categoria', () => {
  const payload = parseOfficialRankingImport({
    contestId: 'contest-1',
    sourceUrl: 'https://example.gov.br/resultado.pdf',
    rows: [
      { candidateKey: 'candidate-1', score: 82.5, category: 'PCD' },
      { candidateKey: 'candidate-1', score: 80, category: 'PCD' },
    ],
  });

  assert.throws(() => assertNoDuplicateRankingRows(payload), /Linha duplicada/);
});

test('permite o mesmo candidateKey em categorias distintas', () => {
  const payload = parseOfficialRankingImport({
    contestId: 'contest-1',
    sourceUrl: 'https://example.gov.br/resultado.pdf',
    rows: [
      { candidateKey: 'candidate-1', score: 82.5, category: 'GENERAL' },
      { candidateKey: 'candidate-1', score: 82.5, category: 'PCD' },
    ],
  });

  assert.doesNotThrow(() => assertNoDuplicateRankingRows(payload));
});
