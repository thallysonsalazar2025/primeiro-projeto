export function sanitizeReportSourceUrl(sourceUrl: string) {
  const parsed = new URL(sourceUrl);

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL de proveniência deve usar HTTP ou HTTPS.');
  }

  return `${parsed.origin}${parsed.pathname}`;
}
