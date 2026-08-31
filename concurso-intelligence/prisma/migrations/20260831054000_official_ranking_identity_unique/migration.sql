-- Remove duplicidades históricas antes de aplicar a identidade única.
-- Mantém a linha mais recentemente importada para cada concurso/cargo/candidato/categoria.
DELETE FROM "OfficialRankingRow" a
USING "OfficialRankingRow" b
WHERE a."contestId" = b."contestId"
  AND a."positionId" IS NOT DISTINCT FROM b."positionId"
  AND a."candidateKey" = b."candidateKey"
  AND a."category" = b."category"
  AND (
    a."importedAt" < b."importedAt"
    OR (a."importedAt" = b."importedAt" AND a."id" < b."id")
  );

CREATE UNIQUE INDEX "OfficialRankingRow_contestId_positionId_candidateKey_category_key"
ON "OfficialRankingRow"("contestId", "positionId", "candidateKey", "category");
