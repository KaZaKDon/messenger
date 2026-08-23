CREATE TABLE "user_profiles" (
    "userId" TEXT NOT NULL,
    "settlement" TEXT,
    "occupation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "user_profiles"
ADD CONSTRAINT "user_profiles_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "user_profiles" ("userId", "settlement", "occupation", "createdAt", "updatedAt")
SELECT
    users."id",
    NULLIF(BTRIM(applications."settlement"), ''),
    NULLIF(BTRIM(applications."occupation"), ''),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users" AS users
LEFT JOIN "registration_applications" AS applications
    ON applications."userId" = users."id"
ON CONFLICT ("userId") DO NOTHING;
