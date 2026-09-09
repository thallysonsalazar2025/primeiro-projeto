import { decodeIngestionUtf8 } from './ingestion-file-size.ts';
import { validatePublicHttpUrl } from './source-url-security.ts';

export type OfficialDocumentType = 'pdf' | 'csv' | 'zip';

export type OfficialDocumentCandidate = {
  sourceUrl: string;
  documentUrl: string;
  documentType: OfficialDocumentType;
};

type HtmlTag = { name: string; attributes: Map<string, string> };

const NAMED_REFERENCES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
};

function decodeHtmlReferences(value: string) {
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z][a-z0-9]+);/gi, (whole, reference: string) => {
    if (reference[0] === '#') {
      const hex = reference[1]?.toLowerCase() === 'x';
      const digits = reference.slice(hex ? 2 : 1);
      const codePoint = Number.parseInt(digits, hex ? 16 : 10);
      if (!Number.isInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        return '\uFFFD';
      }
      return String.fromCodePoint(codePoint);
    }
    return NAMED_REFERENCES[reference.toLowerCase()] ?? whole;
  });
}

function parseAttributes(raw: string) {
  const attributes = new Map<string, string>();
  let index = 0;

  while (index < raw.length) {
    while (index < raw.length && /\s/.test(raw[index]!)) index += 1;
    if (index >= raw.length || raw[index] === '/' || raw[index] === '>') break;

    const nameStart = index;
    while (index < raw.length && !/[\s=/>]/.test(raw[index]!)) index += 1;
    const name = raw.slice(nameStart, index).toLowerCase();
    while (index < raw.length && /\s/.test(raw[index]!)) index += 1;

    let value = '';
    if (raw[index] === '=') {
      index += 1;
      while (index < raw.length && /\s/.test(raw[index]!)) index += 1;
      const quote = raw[index];
      if (quote === '"' || quote === "'") {
        index += 1;
        const valueStart = index;
        while (index < raw.length && raw[index] !== quote) index += 1;
        value = raw.slice(valueStart, index);
        if (index < raw.length) index += 1;
      } else {
        const valueStart = index;
        while (index < raw.length && !/[\s>]/.test(raw[index]!)) index += 1;
        value = raw.slice(valueStart, index);
      }
    }

    if (name && !attributes.has(name)) attributes.set(name, decodeHtmlReferences(value));
  }

  return attributes;
}

function* tokenizeStartTags(html: string): Generator<HtmlTag> {
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open < 0) return;
    const close = html.indexOf('>', open + 1);
    if (close < 0) return;

    let cursor = open + 1;
    if (html[cursor] === '/' || html[cursor] === '!' || html[cursor] === '?') {
      index = close + 1;
      continue;
    }
    while (cursor < close && /\s/.test(html[cursor]!)) cursor += 1;
    const nameStart = cursor;
    while (cursor < close && /[a-z0-9:-]/i.test(html[cursor]!)) cursor += 1;
    const name = html.slice(nameStart, cursor).toLowerCase();
    if (name) yield { name, attributes: parseAttributes(html.slice(cursor, close)) };
    index = close + 1;
  }
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
  const tags = [...tokenizeStartTags(html)];
  let baseUrl = sourceUrl;

  for (const tag of tags) {
    if (tag.name !== 'base') continue;
    const href = tag.attributes.get('href')?.trim();
    if (!href) continue;
    try {
      const candidateBase = validatePublicHttpUrl(new URL(href, sourceUrl).toString(), 'baseUrl');
      if (candidateBase.protocol === 'https:' && allowedHosts.has(candidateBase.hostname.toLowerCase())) baseUrl = candidateBase;
    } catch {
      // Browser semantics use the first valid base; invalid/untrusted bases are ignored here.
    }
    break;
  }

  const candidates = new Map<string, OfficialDocumentCandidate>();
  for (const tag of tags) {
    if (tag.name !== 'a') continue;
    const href = tag.attributes.get('href')?.trim() ?? '';
    if (!href || href.startsWith('#')) continue;

    let resolved: URL;
    try {
      resolved = new URL(href, baseUrl);
    } catch {
      continue;
    }
    resolved.hash = '';

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
