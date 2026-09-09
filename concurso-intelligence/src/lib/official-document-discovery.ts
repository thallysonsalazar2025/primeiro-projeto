import { decodeIngestionUtf8 } from './ingestion-file-size.ts';
import { validatePublicHttpUrl } from './source-url-security.ts';

export type OfficialDocumentType = 'pdf' | 'csv' | 'zip';

export type OfficialDocumentCandidate = {
  sourceUrl: string;
  documentUrl: string;
  documentType: OfficialDocumentType;
};

const HREF_PATTERN = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

function decodeHref(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function documentTypeFromUrl(url: URL): OfficialDocumentType | null {
  const path = url.pathname.toLowerCase();
  if (path.endsWith('.pdf')) return 'pdf';
  if (path.endsWith('.csv')) return 'csv';
  if (path.endsWith('.zip')) return 'zip';
  return null;
}

export function discoverOfficialDocumentCandidates(
  htmlBytes: Uint8Array,
  rawSourceUrl: string,
  options: {
    allowedHosts?: string[];
    allowedTypes?: OfficialDocumentType[];
  } = {},
): OfficialDocumentCandidate[] {
  const sourceUrl = validatePublicHttpUrl(rawSourceUrl, 'sourceUrl');
  if (sourceUrl.protocol !== 'https:') throw new Error('sourceUrl deve usar HTTPS');

  const allowedHosts = new Set(
    (options.allowedHosts ?? [sourceUrl.hostname]).map((host) => host.trim().toLowerCase()).filter(Boolean),
  );
  if (allowedHosts.size === 0) throw new Error('allowedHosts deve conter ao menos um host');

  const allowedTypes = new Set<OfficialDocumentType>(options.allowedTypes ?? ['pdf', 'csv', 'zip']);
  if (allowedTypes.size === 0) throw new Error('allowedTypes deve conter ao menos um tipo');

  const html = decodeIngestionUtf8(htmlBytes);
  const candidates = new Map<string, OfficialDocumentCandidate>();

  for (const match of html.matchAll(HREF_PATTERN)) {
    const href = decodeHref(match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (!href || href.startsWith('#')) continue;

    let resolved: URL;
    try {
      resolved = new URL(href, sourceUrl);
    } catch {
      continue;
    }

    const documentType = documentTypeFromUrl(resolved);
    if (!documentType || !allowedTypes.has(documentType)) continue;

    let validated: URL;
    try {
      validated = validatePublicHttpUrl(resolved.toString(), 'documentUrl');
    } catch {
      continue;
    }

    if (validated.protocol !== 'https:') continue;
    if (!allowedHosts.has(validated.hostname.toLowerCase())) continue;

    const documentUrl = validated.toString();
    if (!candidates.has(documentUrl)) {
      candidates.set(documentUrl, {
        sourceUrl: sourceUrl.toString(),
        documentUrl,
        documentType,
      });
    }
  }

  return [...candidates.values()];
}
