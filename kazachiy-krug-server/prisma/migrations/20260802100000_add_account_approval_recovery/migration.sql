CREATE TYPE "AccountStatus" AS ENUM ('pending', 'active', 'rejected', 'blocked');

ALTER TABLE "users"
ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "approvalCode" TEXT;

ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'pending';
CREATE UNIQUE INDEX "users_approvalCode_key" ON "users"("approvalCode");

CREATE TABLE "password_recovery_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestCode" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_recovery_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_recovery_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "password_recovery_requests_requestCode_key" ON "password_recovery_requests"("requestCode");
CREATE INDEX "password_recovery_requests_userId_createdAt_idx" ON "password_recovery_requests"("userId", "createdAt");
CREATE INDEX "password_recovery_requests_expiresAt_idx" ON "password_recovery_requests"("expiresAt");