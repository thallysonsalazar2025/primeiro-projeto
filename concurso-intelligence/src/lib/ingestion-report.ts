export type IngestionReport = {
  created: number;
  updated: number;
  duplicates: number;
  rejected: number;
  verified: number;
};

export function serializeIngestionReport(report: IngestionReport) {
  return `${JSON.stringify(report, null, 2)}\n`;
}
