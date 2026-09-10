import assert from 'node:assert/strict';
import test from 'node:test';
import { createBndes2024PdftotextExtractor, splitPdftotextPages } from './bndes-2024-pdftotext.ts';

test('splitPdftotextPages preserves physical page numbers and normalizes line endings', () => {
  const pages = splitPdftotextPages('Questão 1\r\n(A) x\f\fQuestão 3\r(C) z\f');

  assert.deepEqual(pages, [
    { page: 1, text: 'Questão 1\n(A) x' },
    { page: 3, text: 'Questão 3\n(C) z' },
  ]);
});

test('splitPdftotextPages drops pages without usable text', () => {
  assert.deepEqual(splitPdftotextPages('   \f\n\t\f'), []);
});

test('pdftotext extractor fails closed for empty PDF bytes', async () => {
  const extractor = createBndes2024PdftotextExtractor();

  await assert.rejects(
    () => extractor(new Uint8Array(), 'exam'),
    /PDF vazio recebido pelo pdftotext em exam/,
  );
});

test('pdftotext extractor validates execution limits before spawning', async () => {
  const extractor = createBndes2024PdftotextExtractor({ timeoutMs: 0 });

  await assert.rejects(
    () => extractor(new Uint8Array([1]), 'answerKey'),
    /timeout do pdftotext deve ser inteiro positivo/,
  );
});
