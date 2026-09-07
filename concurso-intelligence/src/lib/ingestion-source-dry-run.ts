import type { ConfiguredIngestionSource } from './ingestion-source-registry.ts';

export function formatIngestionDryRun(sources: ConfiguredIngestionSource[]) {
  const enabledSources = sources.filter((source) => source.enabled);
  const lines = [
    `[ingestion:sources] dry-run válido: ${enabledSources.length} habilitada(s), ${sources.length - enabledSources.length} desabilitada(s).`,
  ];

  for (const source of enabledSources) {
    lines.push(
      `[ingestion:sources] pronta: ${source.id} -> ${source.enqueue}/${source.namePrefix} (uso: ${source.usageBasis ?? 'não-informado'}${source.expectedSha256 ? ', SHA-256 fixado' : ''})`,
    );
  }

  return lines;
}
