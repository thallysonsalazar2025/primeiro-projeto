import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fetchExternalSource } from '../src/lib/external-source-fetch.ts';
import { assertJsonEnqueuePayload } from '../src/lib/external-source-json.ts';
import { parseMaxIngestionFileBytes } from '../src/lib/ingestion-file-size.ts';
import { parseIngestionUsageBasis, requireIngestionUsageBasis } from '../src/lib/ingestion-source-registry.ts';
import { parseIngestionSourceTimeoutMs } from '../src/lib/ingestion-source-timeout.ts';
import {
  contentAddressedEnqueueName,
  planEnqueuePaths,
  planLatestPublicationPaths,
  publishAtomically,
  readLatestPublication,
  withPublicationLock,
  writeLatestPublication,
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
  const rawUsageBasis = argValue('--usage-basis');
  const usageBasis = enqueue
    ? requireIngestionUsageBasis(rawUsageBasis, '--usage-basis')
    : parseIngestionUsageBasis(rawUsageBasis, '--usage-basis');

  if (!url || (!output && !enqueue) || (enqueue && !name && !namePrefix)) {
    throw new Error(
      'Uso: npm run ingestion:fetch -- <https-url> (--output <arquivo> | --enqueue <questions|rankings> (--name <lote.json> | --name-prefix <prefixo>)) [--sha256 <sha256>] [--manifest <manifesto.json>] [--usage-basis <official|open-data|licensed>]',
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

  const timeoutMs = parseIngestionSourceTimeoutMs(process.env.INGESTION_SOURCE_TIMEOUT_MS);
  const fetchOptions = enqueue
    ? {
        expectedSha256,
        maxBytes: parseMaxIngestionFileBytes(process.env.INGESTION_MAX_FILE_BYTES),
        timeoutMs,
      }
    : { expectedSha256, timeoutMs };
  const result = await fetchExternalSource(url, fetchOptions);

  if (enqueue) {
    assertJsonEnqueuePayload(result.bytes, result.contentType, enqueue);
  }

  const inboxRoot = process.env.INGESTION_INBOX_DIR?.trim() || '/imports';

  async function publishEnqueued(enqueueName: string) {
    const planned = planEnqueuePaths(inboxRoot, enqueue!, enqueueName);
    const manifestBody = `${JSON.stringify({
      schemaVersion: 1,
      sourceUrl: result.sourceUrl,
      finalUrl: result.finalUrl,
      retrievedAt: result.retrievedAt,
      sha256: result.sha256,
      contentType: result.contentType,
      bytes: result.bytes.byteLength,
      output: planned.outputPath,
      enqueueKind: enqueue,
      usageBasis,
    }, null, 2)}\n`;

    await publishAtomically(planned.outputPath, planned.manifestPath, result.bytes, manifestBody);
    return planned;
  }

  if (enqueue && namePrefix) {
    const latestPaths = planLatestPublicationPaths(inboxRoot, enqueue, namePrefix);
    const publication = await withPublicationLock(latestPaths.lockPath, async () => {
      const latest = await readLatestPublication(latestPaths.latestPath);
      if (
        latest?.sha256.toLowerCase() === result.sha256.toLowerCase()
        && latest.usageBasis === usageBasis
      ) {
        return { skipped: true as const, planned: { outputPath: latest.output, manifestPath: latest.manifest } };
      }

      const sequence = (latest?.sequence ?? 0) + 1;
      const enqueueName = contentAddressedEnqueueName(namePrefix, sequence, result.sha256);
      const planned = await publishEnqueued(enqueueName);
      await writeLatestPublication(latestPaths.latestPath, {
        schemaVersion: 1,
        sequence,
        sha256: result.sha256.toLowerCase(),
        output: planned.outputPath,
        manifest: planned.manifestPath,
        usageBasis,
      });
      return { skipped: false as const, planned };
    });

    if (publication.skipped) {
      console.log(`Fonte sem alteração desde a última publicação concluída: ${result.sourceUrl}`);
      console.log(`SHA-256: ${result.sha256}`);
      console.log(`Manifesto existente: ${publication.planned.manifestPath}`);
      return;
    }

    console.log(`Fonte externa coletada: ${publication.planned.outputPath}`);
    console.log(`SHA-256: ${result.sha256}`);
    console.log(`Manifesto: ${publication.planned.manifestPath}`);
    console.log(`Lote publicado na fila: ${enqueue}`);
    return;
  }

  if (enqueue) {
    const planned = await publishEnqueued(name!);
    console.log(`Fonte externa coletada: ${planned.outputPath}`);
    console.log(`SHA-256: ${result.sha256}`);
    console.log(`Manifesto: ${planned.manifestPath}`);
    console.log(`Lote publicado na fila: ${enqueue}`);
    return;
  }

  const planned = {
    outputPath: resolve(output!),
    manifestPath: resolve(manifest ?? `${output}.source.json`),
  };
  const manifestBody = `${JSON.stringify({
    schemaVersion: 1,
    sourceUrl: result.sourceUrl,
    finalUrl: result.finalUrl,
    retrievedAt: result.retrievedAt,
    sha256: result.sha256,
    contentType: result.contentType,
    bytes: result.bytes.byteLength,
    output: planned.outputPath,
    enqueueKind: null,
    usageBasis: usageBasis ?? null,
  }, null, 2)}\n`;

  await mkdir(dirname(planned.outputPath), { recursive: true });
  await mkdir(dirname(planned.manifestPath), { recursive: true });
  await writeFile(planned.outputPath, result.bytes, { flag: 'wx' });
  await writeFile(planned.manifestPath, manifestBody, { encoding: 'utf8', flag: 'wx' });

  console.log(`Fonte externa coletada: ${planned.outputPath}`);
  console.log(`SHA-256: ${result.sha256}`);
  console.log(`Manifesto: ${planned.manifestPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
