import { fetchOfficialCatalogCandidates, type OfficialCatalogFetchResult } from './official-catalog-fetch.ts';
import { fetchOfficialDocument, type OfficialDocumentFetchResult } from './official-document-fetch.ts';
import type { OfficialDocumentCandidate } from './official-document-discovery.ts';

export const BNDES_2024_SOURCE_URL =
  'https://www.bndes.gov.br/wps/portal/site/home/quem-somos/trabalhar-no-bndes/concursos-selecao-publica-2024';

export const BNDES_2024_ALLOWED_HOSTS = ['www.bndes.gov.br'] as const;

type CatalogOptions = Parameters<typeof fetchOfficialCatalogCandidates>[1];

export type Bndes2024AcquisitionOptions = {
  fetchImpl?: CatalogOptions['fetchImpl'];
  resolveHost?: CatalogOptions['resolveHost'];
  now?: CatalogOptions['now'];
  timeoutMs?: number;
  maxCatalogBytes?: number;
  maxDocumentBytes?: number;
};

export type Bndes2024DevelopmentSelection = {
  exam: OfficialDocumentCandidate;
  answerKey: OfficialDocumentCandidate;
};

export type Bndes2024DevelopmentAcquisition = {
  catalog: OfficialCatalogFetchResult;
  selection: Bndes2024DevelopmentSelection;
  exam: OfficialDocumentFetchResult;
  answerKey: OfficialDocumentFetchResult;
};

function normalizedPath(candidate: OfficialDocumentCandidate) {
  const pathname = new URL(candidate.documentUrl).pathname;
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // A URL já passou pelo gate compartilhado; se o path não puder ser decodificado,
    // ele simplesmente não deve casar com um artefato conhecido desta fonte.
  }
  return decoded
    .replace(/\+/g, ' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function selectExactlyOne(
  candidates: OfficialDocumentCandidate[],
  label: string,
  predicate: (normalizedPathname: string) => boolean,
) {
  const matches = candidates.filter((candidate) => candidate.documentType === 'pdf' && predicate(normalizedPath(candidate)));
  if (matches.length !== 1) {
    throw new Error(`BNDES 2024: esperado exatamente 1 ${label}; encontrados ${matches.length}.`);
  }
  return matches[0]!;
}

export function selectBndes2024DevelopmentDocuments(
  candidates: OfficialDocumentCandidate[],
): Bndes2024DevelopmentSelection {
  const exam = selectExactlyOne(
    candidates,
    'caderno objetivo de Análise de Sistemas - Desenvolvimento',
    (path) => path.includes('objetiva') && path.includes('analise de sistemas') && path.includes('desenvolvimento'),
  );
  const answerKey = selectExactlyOne(
    candidates,
    'gabarito final das provas objetivas',
    (path) => path.includes('gabarito') && path.includes('final'),
  );

  if (exam.documentUrl === answerKey.documentUrl) {
    throw new Error('BNDES 2024: caderno e gabarito não podem apontar para o mesmo documento.');
  }

  return { exam, answerKey };
}

export async function fetchBndes2024DevelopmentDocuments(
  options: Bndes2024AcquisitionOptions = {},
): Promise<Bndes2024DevelopmentAcquisition> {
  const allowedHosts = [...BNDES_2024_ALLOWED_HOSTS];
  const catalog = await fetchOfficialCatalogCandidates(BNDES_2024_SOURCE_URL, {
    allowedHosts,
    allowedTypes: ['pdf'],
    maxBytes: options.maxCatalogBytes ?? 2 * 1024 * 1024,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    resolveHost: options.resolveHost,
    now: options.now,
  });
  const selection = selectBndes2024DevelopmentDocuments(catalog.candidates);

  const fetchSelected = (candidate: OfficialDocumentCandidate) => fetchOfficialDocument({
    sourceUrl: catalog.sourceUrl,
    documentUrl: candidate.documentUrl,
    documentType: candidate.documentType,
    usageBasis: 'official-publication',
    license: null,
    termsUrl: null,
  }, {
    allowedHosts,
    maxBytes: options.maxDocumentBytes ?? 2 * 1024 * 1024,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    resolveHost: options.resolveHost,
    now: options.now,
  });

  // Sequencial por desenho: evita rajada desnecessária contra a origem oficial.
  const exam = await fetchSelected(selection.exam);
  const answerKey = await fetchSelected(selection.answerKey);

  return { catalog, selection, exam, answerKey };
}
