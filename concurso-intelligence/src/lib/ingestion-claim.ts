export function isIngestionClaimContention(error: unknown, sourcePathMissing = true) {
  return sourcePathMissing && error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
