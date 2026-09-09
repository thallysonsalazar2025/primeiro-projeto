import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchExternalSource } from './external-source-fetch.ts';

function response(body: string) {
  return new Response(body, { status: 200 });
}

test('rejeita hostname cuja resolução DNS use NAT64 para IPv4 privado', async () => {
  for (const address of [
    '64:ff9b::7f00:1',
    '64:ff9b::a00:1',
    '64:ff9b::ac10:1',
    '64:ff9b::c0a8:101',
  ]) {
    await assert.rejects(
      () => fetchExternalSource('https://example.org/a', {
        fetchImpl: async () => response('abc'),
        resolveHost: async () => [address],
      }),
      /resolver para IP local ou privado/,
    );
  }
});

test('rejeita prefixo NAT64 de uso local retornado pela resolução DNS', async () => {
  await assert.rejects(
    () => fetchExternalSource('https://example.org/a', {
      fetchImpl: async () => response('abc'),
      resolveHost: async () => ['64:ff9b:1::c000:201'],
    }),
    /resolver para IP local ou privado/,
  );
});

test('permite NAT64 público retornado pela resolução DNS', async () => {
  const result = await fetchExternalSource('https://example.org/a', {
    fetchImpl: async () => response('abc'),
    resolveHost: async () => ['64:ff9b::808:808'],
  });

  assert.equal(Buffer.from(result.bytes).toString('utf8'), 'abc');
});
