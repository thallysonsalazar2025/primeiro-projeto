export type ConfiguredIngestionSource = {
  id: string;
  url: string;
  enqueue: 'questions' | 'rankings';
  namePrefix: string;
  expectedSha256?: string;
  enabled: boolean;
};

export type IngestionSourceRegistry = {
  schemaVersion: 1;
  sources: ConfiguredIngestionSource[];
};

function assertPlainObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} deve ser um objeto.`);
  }
}

function assertSafeToken(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(value)) {
    throw new Error(`${label} deve conter apenas letras, números, ponto, hífen ou underscore e ter até 80 caracteres.`);
  }
  return value;
}

function assertHttpsUrl(value: unknown, label: string) {
  if (typeof value !== 'string') throw new Error(`${label} deve ser uma URL HTTPS.`);
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') throw new Error(`${label} deve usar HTTPS.`);
  return parsed.toString();
}

function assertExpectedSha256(value: unknown, label: string) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(`${label} deve ser um SHA-256 hexadecimal de 64 caracteres.`);
  }
  return value.toLowerCase();
}

export function parseIngestionSourceRegistry(input: unknown): IngestionSourceRegistry {
  assertPlainObject(input, 'Registry');
  if (input.schemaVersion !== 1) throw new Error('schemaVersion deve ser 1.');
  if (!Array.isArray(input.sources)) throw new Error('sources deve ser uma lista.');

  const ids = new Set<string>();
  const queueKeys = new Set<string>();
  const sources = input.sources.map((rawSource, index) => {
    const label = `sources[${index}]`;
    assertPlainObject(rawSource, label);
    const id = assertSafeToken(rawSource.id, `${label}.id`);
    if (ids.has(id)) throw new Error(`Fonte duplicada: ${id}.`);
    ids.add(id);

    const enqueue = rawSource.enqueue;
    if (enqueue !== 'questions' && enqueue !== 'rankings') {
      throw new Error(`${label}.enqueue deve ser questions ou rankings.`);
    }

    const namePrefix = assertSafeToken(rawSource.namePrefix, `${label}.namePrefix`);
    const queueKey = `${enqueue}:${namePrefix}`;
    if (queueKeys.has(queueKey)) {
      throw new Error(`Prefixo duplicado para a fila: ${queueKey}.`);
    }
    queueKeys.add(queueKey);

    if (rawSource.enabled !== undefined && typeof rawSource.enabled !== 'boolean') {
      throw new Error(`${label}.enabled deve ser booleano.`);
    }

    return {
      id,
      url: assertHttpsUrl(rawSource.url, `${label}.url`),
      enqueue,
      namePrefix,
      expectedSha256: assertExpectedSha256(rawSource.expectedSha256, `${label}.expectedSha256`),
      enabled: rawSource.enabled !== false,
    } satisfies ConfiguredIngestionSource;
  });

  return { schemaVersion: 1, sources };
}
