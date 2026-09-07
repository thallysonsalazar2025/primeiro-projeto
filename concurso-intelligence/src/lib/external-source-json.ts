function normalizedContentType(contentType: string | null | undefined) {
  return contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

export function assertJsonEnqueuePayload(
  bytes: Uint8Array,
  contentType: string | null | undefined,
) {
  const mediaType = normalizedContentType(contentType);
  if (mediaType && mediaType !== 'application/json' && !mediaType.endsWith('+json')) {
    throw new Error(`Fonte para enqueue deve retornar JSON; Content-Type recebido: ${mediaType}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('Fonte para enqueue deve conter JSON UTF-8 válido.');
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('Fonte para enqueue deve conter um objeto ou array JSON.');
  }

  return parsed;
}
