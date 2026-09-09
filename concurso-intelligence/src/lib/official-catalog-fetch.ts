import { fetchExternalSource } from './external-source-fetch.ts';
import {
  discoverOfficialDocumentCandidates,
  type OfficialDocumentCandidate,
  type OfficialDocumentType,
} from './official-document-discovery.ts';

export type OfficialCatalogFetchResult = {
  sourceUrl: string;
  finalUrl: string;
  retrievedAt: string;
  sha256: string;
  candidates: OfficialDocumentCandidate[];
};

export async function fetchOfficialCatalogCandidates(
  sourceUrl: string,
  options: {
    allowedHosts: string[];
    allowedTypes?: OfficialDocumentType[];
    maxBytes?: number;
    timeoutMs?: number;
    fetchImpl?: Parameters<typeof fetchExternalSource>[1]['fetchImpl'];
    resolveHost?: Parameters<typeof fetchExternalSource>[1]['resolveHost'];
    now?: () => Date;
  },
): Promise<OfficialCatalogFetchResult> {
  if (!options.allowedHosts?.length) {
    throw new Error('allowedHosts deve conter ao menos um host');
  }

  const downloaded = await fetchExternalSource(sourceUrl, {
    allowedHosts: options.allowedHosts,
    maxBytes: options.maxBytes ?? 2 * 1024 * 1024,
    timeoutMs: options.timeoutMs ?? 15_000,
    fetchImpl: options.fetchImpl,
    resolveHost: options.resolveHost,
    now: options.now,
  });

  const contentType = downloaded.contentType?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'text/html' && contentType !== 'application/xhtml+xml') {
    throw new Error(`Catálogo oficial deve ser HTML, recebido: ${downloaded.contentType ?? 'sem Content-Type'}.`);
  }

  const discovered = discoverOfficialDocumentCandidates(
    downloaded.bytes,
    downloaded.finalUrl,
    {
      allowedHosts: options.allowedHosts,
      allowedTypes: options.allowedTypes,
    },
  );

  const canonicalSourceUrl = downloaded.sourceUrl;
  const candidates = discovered.map((candidate) => ({
    ...candidate,
    sourceUrl: canonicalSourceUrl,
  }));

  return {
    sourceUrl: canonicalSourceUrl,
    finalUrl: downloaded.finalUrl,
    retrievedAt: downloaded.retrievedAt,
    sha256: downloaded.sha256,
    candidates,
  };
}
