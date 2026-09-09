import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readLatestPublication } from './external-source-publish.ts';

test('rejeita marcador incremental com UTF-8 inválido antes do parse', async () => {
  const root = await mkdtemp(join(tmpdir(), 'external-source-latest-invalid-utf8-'));
  const latestPath = join(root, 'metadata', 'questions', 'prova.latest.json');
  await mkdir(join(root, 'metadata', 'questions'), { recursive: true });

  const prefix = Buffer.from('{"schemaVersion":1,"sequence":1,"sha256":"');
  const suffix = Buffer.from(`${'a'.repeat(64)}","output":"/imports/questions/lote.json","manifest":"/imports/metadata/questions/lote.json.source.json"}`);
  await writeFile(latestPath, Buffer.concat([prefix, Buffer.from([0xc3, 0x28]), suffix]));

  await assert.rejects(
    readLatestPublication(latestPath),
    /UTF-8 válido/,
  );
});
