-- Create the server-side user role required by the current Prisma schema.
-- The guarded block also allows this migration to be applied safely when
-- the enum was previously created manually with `prisma db push`.
DO $$
BEGIN
    CREATE TYPE "public"."UserRole" AS ENUM ('user', 'admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Existing users remain ordinary users. Administrator rights are assigned
-- explicitly by the admin bootstrap command.
ALTER TABLE "public"."users"
ADD COLUMN IF NOT EXISTS "role" "public"."UserRole" NOT NULL DEFAULT 'user';

-- Administrative actions are recorded separately from application data.
CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_logs_adminId_createdAt_idx"
ON "public"."audit_logs"("adminId", "createdAt");

CREATE INDEX IF NOT EXISTS "audit_logs_targetId_createdAt_idx"
ON "public"."audit_logs"("targetId", "createdAt");
