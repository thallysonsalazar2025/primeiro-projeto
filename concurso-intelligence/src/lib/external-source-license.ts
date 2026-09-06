export const LICENSE_REQUIRED_QUESTION_SOURCE_TYPES = [
  'OPEN_DATASET',
  'GITHUB_REPOSITORY',
] as const;

type LicenseRequiredQuestionSourceType = (typeof LICENSE_REQUIRED_QUESTION_SOURCE_TYPES)[number];

export function questionSourceRequiresLicense(sourceType: string): sourceType is LicenseRequiredQuestionSourceType {
  return LICENSE_REQUIRED_QUESTION_SOURCE_TYPES.includes(sourceType as LicenseRequiredQuestionSourceType);
}

export function validateExternalSourceLicense(sourceType: string, license: string | null | undefined) {
  if (!questionSourceRequiresLicense(sourceType)) return;

  if (!license?.trim()) {
    throw new Error(`source.license é obrigatório para fonte ${sourceType}`);
  }
}
