import assert from 'node:assert/strict';
import test from 'node:test';
import { assertJsonEnqueuePayload } from './external-source-json.ts';

const encode = (value: string) => new TextEncoder().encode(value);

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

test('rejeita JSON escalar', () => {
  assert.throws(
    () => assertJsonEnqueuePayload(encode('42'), 'application/json'),
    /objeto ou array JSON/,
  );
});

test('aceita JSON válido quando servidor omite Content-Type', () => {
  assert.deepEqual(assertJsonEnqueuePayload(encode('{"rankings":[]}'), null), { rankings: [] });
});
