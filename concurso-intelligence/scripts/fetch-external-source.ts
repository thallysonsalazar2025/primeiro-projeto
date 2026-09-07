import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fetchExternalSource } from '../src/lib/external-source-fetch.ts';
import { assertJsonEnqueuePayload } from '../src/lib/external-source-json.ts';
import { parseMaxIngestionFileBytes } from '../src/lib/ingestion-file-size.ts';
import {
  contentAddressedEnqueueName,
  hasPublishedSha,
  planEnqueuePaths,
  publishAtomically,
  type IngestionKind,
} from '../src/lib/external-source-publish.ts';

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseKind(value: string | undefined): IngestionKind | undefined {
  if (!value) return undefined;
  if (value === 'questions' || value === 'rankings') return value;
  throw new Error('--enqueue deve ser questions ou rankings.');
}

async function main() {
  const url = process.argv[2];
  const output = argValue('--output');
  const expectedSha256 = argValue('--sha256');
  const manifest = argValue('--manifest');
  const enqueue = parseKind(argValue('--enqueue'));
  const name = argValue('--name');
  const namePrefix = argValue('--name-prefix');

  if (!url || (!output && !enqueue) || (enqueue && !name && !namePrefix)) {
    throw new Error(
      'Uso: npm run ingestion:fetch -- <https-url> (--output <arquivo> | --enqueue <questions|rankings> (--name <lote.json> | --name-prefix <prefixo>)) [--sha256 <sha256>] [--manifest <manifesto.json>]',
    );
  }
  if (output && enqueue) {
    throw new Error('Use --output ou --enqueue, não ambos.');
  }
  if (enqueue && manifest) {
    throw new Error('--manifest não é aceito com --enqueue; o manifesto é armazenado fora da fila automaticamente.');
  }
  if (name && namePrefix) {
    throw new Error('Use --name ou --name-prefix, não ambos.');
  }

  const fetchOptions = enqueue
    ? {
        expectedSha256,
        maxBytes: parseMaxIngestionFileBytes(process.env.INGESTION_MAX_FILE_BYTES),
      }
    : { expectedSha256 };
  const result = await fetchExternalSource(url, fetchOptions);

  if (enqueue) {
    assertJsonEnqueuePayload(result.bytes, result.contentType, enqueue);
  }

  const enqueueName = enqueue
    ? name ?? contentAddressedEnqueueName(namePrefix!, result.sha256)
    : undefined;
  const planned = enqueue
    ? planEnqueuePaths(process.env.INGESTION_INBOX_DIR?.trim() || '/imports', enqueue, enqueueName!)
    : {
        outputPath: resolve(output!),
        manifestPath: resolve(manifest ?? `${output}.source.json`),
      };

  if (enqueue && namePrefix && await hasPublishedSha(planned.manifestPath, result.sha256)) {
    console.log(`Fonte sem alteração desde a última publicação: ${result.sourceUrl}`);
    console.log(`SHA-256: ${result.sha256}`);
    console.log(`Manifesto existente: ${planned.manifestPath}`);
    return;
  }

  const manifestBody = `${JSON.stringify({
    schemaVersion: 1,
    sourceUrl: result.sourceUrl,
    finalUrl: result.finalUrl,
    retrievedAt: result.retrievedAt,
    sha256: result.sha256,
    contentType: result.contentType,
    bytes: result.bytes.byteLength,
    output: planned.outputPath,
    enqueueKind: enqueue ?? null,
  }, null, 2)}\n`;

  if (enqueue) {
    await publishAtomically(planned.outputPath, planned.manifestPath, result.bytes, manifestBody);
  } else {
    await mkdir(dirname(planned.outputPath), { recursive: true });
    await mkdir(dirname(planned.manifestPath), { recursive: true });
    await writeFile(planned.outputPath, result.bytes, { flag: 'wx' });
    await writeFile(planned.manifestPath, manifestBody, { encoding: 'utf8', flag: 'wx' });
  }

  console.log(`Fonte externa coletada: ${planned.outputPath}`);
  console.log(`SHA-256: ${result.sha256}`);
  console.log(`Manifesto: ${planned.manifestPath}`);
  if (enqueue) console.log(`Lote publicado na fila: ${enqueue}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
