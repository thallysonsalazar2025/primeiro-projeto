import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fetchExternalSource } from '../src/lib/external-source-fetch.ts';

function argValue(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const url = process.argv[2];
  const output = argValue('--output');
  const expectedSha256 = argValue('--sha256');
  const manifest = argValue('--manifest');

  if (!url || !output) {
    throw new Error(
      'Uso: npm run ingestion:fetch -- <https-url> --output <arquivo> [--sha256 <sha256>] [--manifest <manifesto.json>]',
    );
  }

  const outputPath = resolve(output);
  const manifestPath = resolve(manifest ?? `${output}.source.json`);
  const result = await fetchExternalSource(url, { expectedSha256 });

  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(outputPath, result.bytes, { flag: 'wx' });
  await writeFile(
    manifestPath,
    `${JSON.stringify({
      schemaVersion: 1,
      sourceUrl: result.sourceUrl,
      finalUrl: result.finalUrl,
      retrievedAt: result.retrievedAt,
      sha256: result.sha256,
      contentType: result.contentType,
      bytes: result.bytes.byteLength,
      output: outputPath,
    }, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );

  console.log(`Fonte externa coletada: ${outputPath}`);
  console.log(`SHA-256: ${result.sha256}`);
  console.log(`Manifesto: ${manifestPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
