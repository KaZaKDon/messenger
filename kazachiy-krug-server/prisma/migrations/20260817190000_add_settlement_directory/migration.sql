CREATE TABLE "public"."settlements" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "settlements_normalizedName_key"
    ON "public"."settlements"("normalizedName");
CREATE INDEX "settlements_isActive_name_idx"
    ON "public"."settlements"("isActive", "name");

INSERT INTO "public"."settlements" (
    "id", "name", "normalizedName", "isActive", "createdAt", "updatedAt"
)
SELECT
    'settlement_' || md5(normalized_name),
    MIN(trimmed_name),
    normalized_name,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT
        btrim("settlement") AS trimmed_name,
        lower(regexp_replace(btrim("settlement"), '[[:space:]]+', ' ', 'g')) AS normalized_name
    FROM "public"."advertisements"
    WHERE btrim("settlement") <> ''
) source
GROUP BY normalized_name
ON CONFLICT ("normalizedName") DO NOTHING;
