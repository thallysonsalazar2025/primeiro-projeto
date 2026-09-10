import {
  buildBndes2024OfficialExtraction,
  type Bndes2024TextPage,
} from './bndes-2024-extraction.ts';
import { loadBndes2024Snapshot } from './bndes-2024-snapshot.ts';
import type { OfficialQuestionExtraction } from './official-question-extraction.ts';

export type Bndes2024PdfRole = 'exam' | 'answerKey';

export type Bndes2024PdfTextExtractor = (
  bytes: Uint8Array,
  role: Bndes2024PdfRole,
) => Promise<Bndes2024TextPage[]>;

function validateTextPages(role: Bndes2024PdfRole, pages: Bndes2024TextPage[]) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error(`BNDES 2024: extrator não retornou páginas para ${role}.`);
  }

  const seen = new Set<number>();
  let previousPage = 0;
  for (const page of pages) {
    if (!Number.isInteger(page.page) || page.page <= 0) {
      throw new Error(`BNDES 2024: número de página inválido em ${role}.`);
    }
    if (seen.has(page.page)) {
      throw new Error(`BNDES 2024: página ${page.page} duplicada em ${role}.`);
    }
    if (page.page <= previousPage) {
      throw new Error(`BNDES 2024: páginas de ${role} devem estar em ordem crescente.`);
    }
    if (typeof page.text !== 'string' || !page.text.trim()) {
      throw new Error(`BNDES 2024: página ${page.page} de ${role} está sem texto.`);
    }

    seen.add(page.page);
    previousPage = page.page;
  }

  return pages;
}

export async function buildBndes2024ExtractionFromSnapshot(
  snapshotDir: string,
  extractPdfText: Bndes2024PdfTextExtractor,
): Promise<OfficialQuestionExtraction> {
  const snapshot = await loadBndes2024Snapshot(snapshotDir);

  // Sequencial por desenho: mantém consumo de memória previsível para os dois PDFs.
  const examPages = validateTextPages(
    'exam',
    await extractPdfText(snapshot.exam.bytes, 'exam'),
  );
  const answerKeyPages = validateTextPages(
    'answerKey',
    await extractPdfText(snapshot.answerKey.bytes, 'answerKey'),
  );

  const answerKeyText = answerKeyPages.map((page) => page.text).join('\n');

  return buildBndes2024OfficialExtraction(examPages, answerKeyText, {
    source: {
      type: 'OFFICIAL_PDF',
      url: snapshot.exam.manifest.finalUrl,
      sourceHash: snapshot.exam.manifest.sha256,
      retrievedAt: snapshot.exam.manifest.retrievedAt,
      notes: `Fonte oficial BNDES 2024: ${snapshot.exam.manifest.sourceUrl}`,
    },
    answerKey: {
      url: snapshot.answerKey.manifest.finalUrl,
    },
    board: {
      acronym: 'CESGRANRIO',
      name: 'Fundação Cesgranrio',
      website: 'https://www.cesgranrio.org.br/',
    },
    exam: {
      title: 'BNDES 2024 - Análise de Sistemas - Desenvolvimento',
      year: 2024,
      sourceDocument: snapshot.exam.manifest.documentUrl,
      sourceSha256: snapshot.exam.manifest.sha256,
    },
  });
}
