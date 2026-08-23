DROP INDEX IF EXISTS "password_recovery_requests_requestCode_key";

ALTER TABLE "password_recovery_requests"
ADD COLUMN "clientSecretHash" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "reviewedById" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewReason" TEXT,
ADD COLUMN "completedAt" TIMESTAMP(3);

-- Старые незавершённые заявки не были привязаны к браузеру и не могут
-- безопасно использоваться в новом процессе восстановления.
UPDATE "password_recovery_requests"
SET "status" = 'expired',
    "resolvedAt" = COALESCE("resolvedAt", CURRENT_TIMESTAMP)
WHERE "clientSecretHash" IS NULL;

CREATE INDEX "password_recovery_requests_status_createdAt_idx"
ON "password_recovery_requests"("status", "createdAt");

CREATE INDEX "password_recovery_requests_requestCode_status_idx"
ON "password_recovery_requests"("requestCode", "status");

ALTER TABLE "password_recovery_requests"
ADD CONSTRAINT "password_recovery_requests_status_check"
CHECK ("status" IN ('pending', 'approved', 'rejected', 'completed', 'expired', 'superseded'));
