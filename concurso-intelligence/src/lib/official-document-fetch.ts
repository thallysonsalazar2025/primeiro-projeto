import { fetchExternalSource } from './external-source-fetch.ts';
import {
  parseOfficialDocumentManifest,
  type OfficialDocumentManifest,
} from './official-document-manifest.ts';

export type OfficialDocumentFetchInput = {
  sourceUrl: string;
  documentUrl: string;
  documentType: 'pdf' | 'csv' | 'zip';
  usageBasis: 'official-publication' | 'open-data' | 'licensed';
  license?: string | null;
  termsUrl?: string | null;
};

export type OfficialDocumentFetchResult = {
  bytes: Uint8Array;
  manifest: OfficialDocumentManifest;
};

export async function fetchOfficialDocument(
  input: OfficialDocumentFetchInput,
  options: Parameters<typeof fetchExternalSource>[1] = {},
): Promise<OfficialDocumentFetchResult> {
  const downloaded = await fetchExternalSource(input.documentUrl, options);

  const manifest = parseOfficialDocumentManifest({
    schemaVersion: 1,
    sourceUrl: input.sourceUrl,
    documentUrl: input.documentUrl,
    finalUrl: downloaded.finalUrl,
    documentType: input.documentType,
    usageBasis: input.usageBasis,
    license: input.license ?? null,
    termsUrl: input.termsUrl ?? null,
    retrievedAt: downloaded.retrievedAt,
    sha256: downloaded.sha256,
    contentType: downloaded.contentType ?? '',
    bytes: downloaded.bytes.byteLength,
  });

  return { bytes: downloaded.bytes, manifest };
}
