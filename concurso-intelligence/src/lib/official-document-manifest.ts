import { z } from 'zod';
import { validatePublicHttpUrl } from './source-url-security.ts';

const publicHttpsUrl = z.string().superRefine((value, context) => {
  try {
    const parsed = validatePublicHttpUrl(value, 'URL do manifesto');
    if (parsed.protocol !== 'https:') {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'deve usar HTTPS' });
    }
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : 'URL inválida',
    });
  }
});

const acceptedContentTypes: Record<'pdf' | 'csv' | 'zip', Set<string>> = {
  pdf: new Set(['application/pdf']),
  csv: new Set(['text/csv', 'application/csv', 'application/vnd.ms-excel']),
  zip: new Set(['application/zip', 'application/x-zip-compressed']),
};

export const officialDocumentManifestSchema = z.object({
  schemaVersion: z.literal(1),
  sourceUrl: publicHttpsUrl,
  documentUrl: publicHttpsUrl,
  finalUrl: publicHttpsUrl,
  documentType: z.enum(['pdf', 'csv', 'zip']),
  usageBasis: z.enum(['official-publication', 'open-data', 'licensed']),
  license: z.string().trim().min(1).nullable(),
  termsUrl: publicHttpsUrl.nullable(),
  retrievedAt: z.string().datetime({ offset: true }),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'sha256 inválido').transform((value) => value.toLowerCase()),
  contentType: z.string().trim().min(1),
  bytes: z.number().int().positive(),
}).superRefine((manifest, context) => {
  if ((manifest.usageBasis === 'open-data' || manifest.usageBasis === 'licensed') && !manifest.license) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['license'],
      message: 'fontes reutilizáveis externas exigem licença explícita para rastreabilidade',
    });
  }

  const mediaType = manifest.contentType.toLowerCase().split(';', 1)[0].trim();
  if (!acceptedContentTypes[manifest.documentType].has(mediaType)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contentType'],
      message: `contentType incompatível com documentType ${manifest.documentType}`,
    });
  }
});

export type OfficialDocumentManifest = z.infer<typeof officialDocumentManifestSchema>;

export function parseOfficialDocumentManifest(input: unknown): OfficialDocumentManifest {
  return officialDocumentManifestSchema.parse(input);
}
