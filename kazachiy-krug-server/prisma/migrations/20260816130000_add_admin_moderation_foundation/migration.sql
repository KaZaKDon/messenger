-- Users are removed softly so conversations, moderation evidence and audit
-- history remain intact. Active sessions are revoked by the service layer.
ALTER TYPE "public"."AccountStatus" ADD VALUE IF NOT EXISTS 'deleted';

CREATE TYPE "public"."GroupContentType" AS ENUM (
    'chat',
    'notice',
    'advertisement'
);

CREATE TYPE "public"."AdvertisementStatus" AS ENUM (
    'active',
    'needs_edit',
    'removed',
    'expired',
    'deleted'
);

CREATE TYPE "public"."ComplaintTargetType" AS ENUM (
    'advertisement',
    'message',
    'user',
    'group'
);

CREATE TYPE "public"."ComplaintStatus" AS ENUM (
    'new',
    'in_review',
    'resolved',
    'rejected'
);

CREATE TYPE "public"."SupportRequestStatus" AS ENUM (
    'new',
    'in_progress',
    'answered',
    'closed'
);

CREATE TYPE "public"."PaymentRecordStatus" AS ENUM ('recorded', 'voided');

ALTER TABLE "public"."users"
ADD COLUMN "blockedAt" TIMESTAMP(3),
ADD COLUMN "blockReason" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletionReason" TEXT;

ALTER TABLE "public"."group_rules"
ADD COLUMN "contentType" "public"."GroupContentType" NOT NULL DEFAULT 'chat',
ADD COLUMN "advertisementLifetimeDays" INTEGER;

-- Preserve the product rules agreed for the thirteen initial groups.
UPDATE "public"."group_rules"
SET "contentType" = 'notice'
WHERE "chatId" = 'group-1';

UPDATE "public"."group_rules"
SET "contentType" = 'advertisement'
WHERE "chatId" IN (
    'group-2', 'group-3', 'group-4', 'group-5', 'group-6',
    'group-7', 'group-8', 'group-9', 'group-10', 'group-11'
);

UPDATE "public"."group_rules"
SET "advertisementLifetimeDays" = 7
WHERE "chatId" IN (
    'group-4', 'group-5', 'group-6', 'group-7',
    'group-8', 'group-9', 'group-10', 'group-11'
);

ALTER TABLE "public"."group_rules"
ADD CONSTRAINT "group_rules_advertisement_lifetime_check"
CHECK (
    "advertisementLifetimeDays" IS NULL
    OR "advertisementLifetimeDays" BETWEEN 1 AND 365
);

CREATE TABLE "public"."advertisements" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "settlement" TEXT NOT NULL,
    "price" TEXT,
    "description" TEXT NOT NULL,
    "status" "public"."AdvertisementStatus" NOT NULL DEFAULT 'active',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "moderationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advertisements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "advertisements_expiry_check" CHECK (
        "expiresAt" IS NULL OR "expiresAt" > "publishedAt"
    )
);

CREATE TABLE "public"."advertisement_images" (
    "id" TEXT NOT NULL,
    "advertisementId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advertisement_images_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "advertisement_images_sort_order_check" CHECK (
        "sortOrder" BETWEEN 0 AND 4
    )
);

CREATE TABLE "public"."complaints" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "public"."ComplaintTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetSnapshot" JSONB,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "public"."ComplaintStatus" NOT NULL DEFAULT 'new',
    "assignedToId" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."support_requests" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "public"."SupportRequestStatus" NOT NULL DEFAULT 'new',
    "assignedToId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."support_request_messages" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_request_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."group_payments" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "ownerId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "periodStartsAt" TIMESTAMP(3) NOT NULL,
    "periodEndsAt" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,
    "status" "public"."PaymentRecordStatus" NOT NULL DEFAULT 'recorded',
    "recordedById" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "group_payments_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "group_payments_period_check" CHECK (
        "periodEndsAt" > "periodStartsAt"
    )
);

CREATE UNIQUE INDEX "advertisement_images_advertisementId_sortOrder_key"
ON "public"."advertisement_images"("advertisementId", "sortOrder");

CREATE INDEX "advertisements_chatId_status_publishedAt_idx"
ON "public"."advertisements"("chatId", "status", "publishedAt");
CREATE INDEX "advertisements_authorId_status_expiresAt_idx"
ON "public"."advertisements"("authorId", "status", "expiresAt");
CREATE INDEX "advertisements_status_expiresAt_idx"
ON "public"."advertisements"("status", "expiresAt");
CREATE INDEX "advertisement_images_advertisementId_idx"
ON "public"."advertisement_images"("advertisementId");

CREATE INDEX "complaints_status_createdAt_idx"
ON "public"."complaints"("status", "createdAt");
CREATE INDEX "complaints_reporterId_createdAt_idx"
ON "public"."complaints"("reporterId", "createdAt");
CREATE INDEX "complaints_targetType_targetId_idx"
ON "public"."complaints"("targetType", "targetId");
CREATE INDEX "complaints_assignedToId_status_idx"
ON "public"."complaints"("assignedToId", "status");

CREATE INDEX "support_requests_status_createdAt_idx"
ON "public"."support_requests"("status", "createdAt");
CREATE INDEX "support_requests_authorId_createdAt_idx"
ON "public"."support_requests"("authorId", "createdAt");
CREATE INDEX "support_requests_assignedToId_status_idx"
ON "public"."support_requests"("assignedToId", "status");
CREATE INDEX "support_request_messages_requestId_createdAt_idx"
ON "public"."support_request_messages"("requestId", "createdAt");
CREATE INDEX "support_request_messages_authorId_createdAt_idx"
ON "public"."support_request_messages"("authorId", "createdAt");

CREATE INDEX "group_payments_chatId_paidAt_idx"
ON "public"."group_payments"("chatId", "paidAt");
CREATE INDEX "group_payments_ownerId_paidAt_idx"
ON "public"."group_payments"("ownerId", "paidAt");
CREATE INDEX "group_payments_status_periodEndsAt_idx"
ON "public"."group_payments"("status", "periodEndsAt");

ALTER TABLE "public"."advertisements"
ADD CONSTRAINT "advertisements_chatId_fkey"
FOREIGN KEY ("chatId") REFERENCES "public"."group_rules"("chatId")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."advertisements"
ADD CONSTRAINT "advertisements_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "public"."users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."advertisements"
ADD CONSTRAINT "advertisements_moderatedById_fkey"
FOREIGN KEY ("moderatedById") REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."advertisement_images"
ADD CONSTRAINT "advertisement_images_advertisementId_fkey"
FOREIGN KEY ("advertisementId") REFERENCES "public"."advertisements"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."complaints"
ADD CONSTRAINT "complaints_reporterId_fkey"
FOREIGN KEY ("reporterId") REFERENCES "public"."users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."complaints"
ADD CONSTRAINT "complaints_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."support_requests"
ADD CONSTRAINT "support_requests_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "public"."users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."support_requests"
ADD CONSTRAINT "support_requests_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."support_request_messages"
ADD CONSTRAINT "support_request_messages_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "public"."support_requests"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."support_request_messages"
ADD CONSTRAINT "support_request_messages_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "public"."users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."group_payments"
ADD CONSTRAINT "group_payments_chatId_fkey"
FOREIGN KEY ("chatId") REFERENCES "public"."group_rules"("chatId")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."group_payments"
ADD CONSTRAINT "group_payments_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."group_payments"
ADD CONSTRAINT "group_payments_recordedById_fkey"
FOREIGN KEY ("recordedById") REFERENCES "public"."users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."group_payments"
ADD CONSTRAINT "group_payments_voidedById_fkey"
FOREIGN KEY ("voidedById") REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
