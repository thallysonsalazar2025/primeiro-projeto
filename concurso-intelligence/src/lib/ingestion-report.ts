export type IngestionReport = {
  schemaVersion: 1;
  created: number;
  updated: number;
  duplicates: number;
  rejected: number;
  verified: number;
  batch: {
    generatedAt: string;
    inputSha256: string;
    sourceType: string;
    sourceUrl: string;
    examTitle: string;
    examYear: number;
  };
};

export function serializeIngestionReport(report: IngestionReport) {
  return `${JSON.stringify(report, null, 2)}\n`;
}
