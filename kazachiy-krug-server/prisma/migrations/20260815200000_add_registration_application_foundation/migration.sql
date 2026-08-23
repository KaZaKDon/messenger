CREATE TYPE "public"."RegistrationPurpose" AS ENUM (
    'community',
    'information',
    'find_offers',
    'publish_announcements',
    'represent_organization',
    'other'
);

CREATE TYPE "public"."LegalAcceptanceType" AS ENUM (
    'terms_rules',
    'personal_data',
    'public_profile'
);

-- Private registration details are separated from the public User profile.
CREATE TABLE "public"."registration_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "settlement" TEXT NOT NULL,
    "occupation" TEXT NOT NULL,
    "purposes" "public"."RegistrationPurpose"[] NOT NULL,
    "purposeNote" TEXT,
    "approvalCode" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_applications_pkey" PRIMARY KEY ("id")
);

-- Each acceptance is an immutable evidence row. Re-acceptance creates a new row.
CREATE TABLE "public"."legal_acceptances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."LegalAcceptanceType" NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'registration',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registration_applications_userId_key"
ON "public"."registration_applications"("userId");

-- The code is cleared after review, so four-digit codes can be reused later.
CREATE UNIQUE INDEX "registration_applications_approvalCode_key"
ON "public"."registration_applications"("approvalCode");

CREATE INDEX "registration_applications_expiresAt_idx"
ON "public"."registration_applications"("expiresAt");

CREATE INDEX "registration_applications_reviewedAt_idx"
ON "public"."registration_applications"("reviewedAt");

CREATE INDEX "registration_applications_lastName_firstName_idx"
ON "public"."registration_applications"("lastName", "firstName");

CREATE INDEX "legal_acceptances_userId_type_acceptedAt_idx"
ON "public"."legal_acceptances"("userId", "type", "acceptedAt");

CREATE INDEX "legal_acceptances_type_acceptedAt_idx"
ON "public"."legal_acceptances"("type", "acceptedAt");

ALTER TABLE "public"."registration_applications"
ADD CONSTRAINT "registration_applications_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."registration_applications"
ADD CONSTRAINT "registration_applications_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."legal_acceptances"
ADD CONSTRAINT "legal_acceptances_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."registration_applications"
ADD CONSTRAINT "registration_applications_expiry_check"
CHECK ("expiresAt" > "createdAt");

ALTER TABLE "public"."registration_applications"
ADD CONSTRAINT "registration_applications_code_check"
CHECK ("approvalCode" IS NULL OR "approvalCode" ~ '^[0-9]{4}$');
