import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchExternalSource } from './external-source-fetch.ts';

function response(body: string, init: ResponseInit & { url?: string } = {}) {
  const result = new Response(body, init);
  Object.defineProperty(result, 'url', { value: init.url ?? 'https://example.org/final.json' });
  return result;
}

test('baixa fonte HTTPS e registra hash/data auditáveis', async () => {
  const result = await fetchExternalSource('https://example.org/source.json', {
    fetchImpl: async () => response('abc', {
      status: 200,
      headers: { 'content-type': 'application/json', 'content-length': '3' },
    }),
    now: () => new Date('2026-09-07T02:30:00.000Z'),
  });

  assert.equal(Buffer.from(result.bytes).toString('utf8'), 'abc');
  assert.equal(result.sha256, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(result.retrievedAt, '2026-09-07T02:30:00.000Z');
  assert.equal(result.contentType, 'application/json');
});

test('rejeita protocolo não HTTPS, localhost e IPs privados', async () => {
  await assert.rejects(() => fetchExternalSource('http://example.org/a'), /HTTPS/);
  await assert.rejects(() => fetchExternalSource('https://localhost/a'), /local ou privado/);
  await assert.rejects(() => fetchExternalSource('https://127.0.0.1/a'), /local ou privado/);
  await assert.rejects(() => fetchExternalSource('https://169.254.169.254/latest/meta-data'), /local ou privado/);
  await assert.rejects(() => fetchExternalSource('https://10.0.0.1/a'), /local ou privado/);
});

test('rejeita hostname público que resolva para rede privada', async () => {
  await assert.rejects(
    () => fetchExternalSource('https://example.org/a', {
      fetchImpl: async () => response('abc'),
      resolveHost: async () => ['192.168.1.10'],
    }),
    /resolver para IP local ou privado/,
  );
});

test('valida cada destino de redirecionamento antes de segui-lo', async () => {
  let calls = 0;
  await assert.rejects(
    () => fetchExternalSource('https://example.org/a', {
      fetchImpl: async () => {
        calls += 1;
        return response('', {
          status: 302,
          headers: { location: 'https://169.254.169.254/latest/meta-data' },
        });
      },
    }),
    /local ou privado/,
  );
  assert.equal(calls, 1);
});

test('segue redirecionamento HTTPS público dentro do limite', async () => {
  const requested: string[] = [];
  const result = await fetchExternalSource('https://example.org/a', {
    fetchImpl: async (input) => {
      const url = input.toString();
      requested.push(url);
      if (url === 'https://example.org/a') {
        return response('', {
          status: 302,
          headers: { location: 'https://cdn.example.org/data.json' },
        });
      }
      return response('abc', { status: 200 });
    },
  });

  assert.deepEqual(requested, ['https://example.org/a', 'https://cdn.example.org/data.json']);
  assert.equal(result.finalUrl, 'https://cdn.example.org/data.json');
});

test('rejeita resposta HTTP sem sucesso', async () => {
  await assert.rejects(
    () => fetchExternalSource('https://example.org/a', {
      fetchImpl: async () => response('nope', { status: 404 }),
    }),
    /HTTP 404/,
  );
});

test('rejeita fonte acima do limite pelo header ou pelos bytes reais', async () => {
  await assert.rejects(
    () => fetchExternalSource('https://example.org/a', {
      maxBytes: 2,
      fetchImpl: async () => response('abc', { headers: { 'content-length': '3' } }),
    }),
    /excede o limite/,
  );

  await assert.rejects(
    () => fetchExternalSource('https://example.org/a', {
      maxBytes: 2,
      fetchImpl: async () => response('abc'),
    }),
    /excede o limite/,
  );
});

test('valida SHA-256 esperado quando informado', async () => {
  const valid = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  const ok = await fetchExternalSource('https://example.org/a', {
    expectedSha256: valid,
    fetchImpl: async () => response('abc'),
  });
  assert.equal(ok.sha256, valid);

  await assert.rejects(
    () => fetchExternalSource('https://example.org/a', {
      expectedSha256: '0'.repeat(64),
      fetchImpl: async () => response('abc'),
    }),
    /SHA-256 divergente/,
  );
});

test('aborta somente a coleta de rede quando o timeout expira', async () => {
  let observedSignal: AbortSignal | undefined;
  await assert.rejects(
    () => fetchExternalSource('https://example.org/slow.json', {
      timeoutMs: 10,
      fetchImpl: async (_input, init) => {
        observedSignal = init?.signal ?? undefined;
        await new Promise<never>((_resolve, reject) => {
          observedSignal?.addEventListener('abort', () => reject(observedSignal?.reason), { once: true });
        });
        throw new Error('unreachable');
      },
    }),
    /timeout de 10 ms/,
  );
  assert.equal(observedSignal?.aborted, true);
});
