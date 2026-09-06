export function shouldCreateProvenanceRevision(
  existingSourceHash: string | null | undefined,
  incomingSourceHash: string | null | undefined,
) {
  const existing = existingSourceHash?.trim().toLowerCase() || null;
  const incoming = incomingSourceHash?.trim().toLowerCase() || null;

  return Boolean(existing && incoming && existing !== incoming);
}

export function nextProvenanceHash(
  existingSourceHash: string | null | undefined,
  incomingSourceHash: string | null | undefined,
) {
  return incomingSourceHash?.trim() || existingSourceHash?.trim() || null;
}
