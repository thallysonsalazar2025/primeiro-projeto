import type { ConfiguredIngestionSource } from './ingestion-source-registry.ts';

export type IngestionSourceFailure = {
  id: string;
  error: Error;
};

export type IngestionSourceRunResult = {
  attempted: number;
  succeeded: number;
  failures: IngestionSourceFailure[];
};

export async function runConfiguredIngestionSources(
  sources: ConfiguredIngestionSource[],
  execute: (source: ConfiguredIngestionSource) => Promise<void>,
): Promise<IngestionSourceRunResult> {
  const enabledSources = sources.filter((source) => source.enabled);
  const failures: IngestionSourceFailure[] = [];
  let succeeded = 0;

  for (const source of enabledSources) {
    try {
      await execute(source);
      succeeded += 1;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      failures.push({ id: source.id, error });
    }
  }

  return {
    attempted: enabledSources.length,
    succeeded,
    failures,
  };
}
