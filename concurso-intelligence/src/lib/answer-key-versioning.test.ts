import test from 'node:test';
import assert from 'node:assert/strict';
import { decideFinalAnswerKeyPersistence } from './answer-key-versioning.ts';

const incoming = {
  answer: 'B',
  isAnnulled: false,
  sourceUrl: 'https://example.gov.br/gabarito-definitivo.pdf',
  publishedAt: new Date('2026-09-08T06:00:00Z'),
  legacyQuestionSourceUrl: 'https://example.gov.br/prova.pdf',
};

test('reutiliza versão idêntica do mesmo gabarito', () => {
  assert.equal(decideFinalAnswerKeyPersistence({
    kind: 'FINAL',
    answer: 'B',
    isAnnulled: false,
    sourceUrl: incoming.sourceUrl,
    publishedAt: incoming.publishedAt,
  }, incoming), 'REUSE');
});

test('faz backfill quando a versão antiga aponta para a prova', () => {
  assert.equal(decideFinalAnswerKeyPersistence({
    kind: 'FINAL',
    answer: 'B',
    isAnnulled: false,
    sourceUrl: incoming.legacyQuestionSourceUrl,
    publishedAt: null,
  }, incoming), 'BACKFILL');
});

test('preserva histórico quando a mesma resposta vem de outro gabarito oficial', () => {
  assert.equal(decideFinalAnswerKeyPersistence({
    kind: 'FINAL',
    answer: 'B',
    isAnnulled: false,
    sourceUrl: 'https://example.gov.br/gabarito-anterior.pdf',
    publishedAt: new Date('2026-09-01T06:00:00Z'),
  }, incoming), 'APPEND');
});

test('cria nova versão quando o conteúdo do gabarito muda', () => {
  assert.equal(decideFinalAnswerKeyPersistence({
    kind: 'FINAL',
    answer: 'A',
    isAnnulled: false,
    sourceUrl: incoming.sourceUrl,
    publishedAt: incoming.publishedAt,
  }, incoming), 'APPEND');
});
