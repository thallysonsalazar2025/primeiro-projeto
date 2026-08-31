-- Rankings oficiais sem cargo não são consumidos pelo estimador V2.
-- Remove registros legados sem posição antes de tornar a coluna obrigatória.
DELETE FROM "OfficialRankingRow"
WHERE "positionId" IS NULL;

-- Remove duplicidades históricas mantendo a linha mais recentemente importada.
DELETE FROM "OfficialRankingRow" a
USING "OfficialRankingRow" b
WHERE a."contestId" = b."contestId"
  AND a."positionId" = b."positionId"
  AND a."candidateKey" = b."candidateKey"
  AND a."category" = b."category"
  AND (
    a."importedAt" < b."importedAt"
    OR (a."importedAt" = b."importedAt" AND a."id" < b."id")
  );

ALTER TABLE "OfficialRankingRow"
ALTER COLUMN "positionId" SET NOT NULL;

CREATE UNIQUE INDEX "OfficialRankingRow_contestId_positionId_candidateKey_category_key"
ON "OfficialRankingRow"("contestId", "positionId", "candidateKey", "category");
