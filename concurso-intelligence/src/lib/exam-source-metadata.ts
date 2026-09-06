export function nextExamSourceMetadata(
  current: string | null,
  incoming: string | null | undefined,
) {
  const normalized = incoming?.trim();
  return normalized ? normalized : current;
}
