import { z } from 'zod';

const httpsUrl = z.string().url().refine((value) => new URL(value).protocol === 'https:', {
  message: 'deve usar HTTPS',
});

export const officialDocumentManifestSchema = z.object({
  schemaVersion: z.literal(1),
  sourceUrl: httpsUrl,
  documentUrl: httpsUrl,
  finalUrl: httpsUrl,
  documentType: z.enum(['pdf', 'csv', 'zip']),
  usageBasis: z.enum(['official-publication', 'open-data', 'licensed']),
  license: z.string().trim().min(1).nullable(),
  termsUrl: httpsUrl.nullable(),
  retrievedAt: z.string().datetime({ offset: true }),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'sha256 inválido').transform((value) => value.toLowerCase()),
  contentType: z.string().trim().min(1),
  bytes: z.number().int().positive(),
}).superRefine((manifest, context) => {
  if (manifest.usageBasis === 'open-data' && !manifest.license) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['license'],
      message: 'fontes open-data exigem licença explícita para rastreabilidade',
    });
  }

  if (manifest.usageBasis === 'licensed' && !manifest.license && !manifest.termsUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['license'],
      message: 'fontes licenciadas exigem licença ou termsUrl verificável',
    });
  }
});

export type OfficialDocumentManifest = z.infer<typeof officialDocumentManifestSchema>;

export function parseOfficialDocumentManifest(input: unknown): OfficialDocumentManifest {
  return officialDocumentManifestSchema.parse(input);
}
