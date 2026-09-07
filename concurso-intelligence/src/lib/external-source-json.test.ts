import assert from 'node:assert/strict';
import test from 'node:test';
import { assertJsonEnqueuePayload } from './external-source-json.ts';

const encode = (value: string) => new TextEncoder().encode(value);

const questionBatch = {
  source: {
    type: 'OFFICIAL_WEB',
    url: 'https://example.gov.br/prova',
  },
  board: {
    acronym: 'TESTE',
    name: 'Banca Teste',
  },
  exam: {
    title: 'Prova Teste',
    year: 2026,
  },
  questions: [
    {
      number: 1,
      statement: 'Enunciado válido?',
      choices: [
        { label: 'A', text: 'Sim', isCorrect: true },
        { label: 'B', text: 'Não', isCorrect: false },
      ],
    },
  ],
};

const rankingBatch = {
  contestId: 'contest-1',
  positionId: 'position-1',
  sourceUrl: 'https://example.gov.br/resultado',
  rows: [
    {
      candidateKey: 'candidate-1',
      score: 90,
      rank: 1,
      category: 'GENERAL',
    },
  ],
};

test('aceita application/json válido', () => {
  const parsed = assertJsonEnqueuePayload(encode('{"questions":[]}'), 'application/json; charset=utf-8');
  assert.deepEqual(parsed, { questions: [] });
});

test('aceita media type +json e payload array', () => {
  const parsed = assertJsonEnqueuePayload(encode('[{"id":1}]'), 'application/problem+json');
  assert.deepEqual(parsed, [{ id: 1 }]);
});

test('rejeita Content-Type incompatível antes de publicar', () => {
  assert.throws(
    () => assertJsonEnqueuePayload(encode('{"questions":[]}'), 'text/html'),
    /deve retornar JSON/,
  );
});

test('rejeita bytes que não formam JSON válido', () => {
  assert.throws(
    () => assertJsonEnqueuePayload(encode('<html>erro</html>'), 'application/json'),
    /JSON UTF-8 válido/,
  );
});

test('rejeita BOM UTF-8 que os importadores não conseguem parsear', () => {
  const payload = new Uint8Array([0xef, 0xbb, 0xbf, ...encode('{"questions":[]}')]);
  assert.throws(
    () => assertJsonEnqueuePayload(payload, 'application/json'),
    /sem BOM/,
  );
});

test('rejeita JSON escalar', () => {
  assert.throws(
    () => assertJsonEnqueuePayload(encode('42'), 'application/json'),
    /objeto ou array JSON/,
  );
});

test('aceita JSON válido quando servidor omite Content-Type', () => {
  assert.deepEqual(assertJsonEnqueuePayload(encode('{"rankings":[]}'), null), { rankings: [] });
});

test('valida contrato completo de questões antes de publicar na fila questions', () => {
  const parsed = assertJsonEnqueuePayload(
    encode(JSON.stringify(questionBatch)),
    'application/json',
    'questions',
  );
  assert.equal(parsed.exam.title, 'Prova Teste');
  assert.equal(parsed.questions.length, 1);
});

test('rejeita envelope de ranking quando destino é a fila questions', () => {
  assert.throws(
    () => assertJsonEnqueuePayload(encode(JSON.stringify(rankingBatch)), 'application/json', 'questions'),
  );
});

test('valida contrato completo de ranking antes de publicar na fila rankings', () => {
  const parsed = assertJsonEnqueuePayload(
    encode(JSON.stringify(rankingBatch)),
    'application/json',
    'rankings',
  );
  assert.equal(parsed.contestId, 'contest-1');
  assert.equal(parsed.rows.length, 1);
});

test('rejeita lote de questões quando destino é a fila rankings', () => {
  assert.throws(
    () => assertJsonEnqueuePayload(encode(JSON.stringify(questionBatch)), 'application/json', 'rankings'),
  );
});
