ALTER TABLE "public"."support_requests"
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other',
ADD COLUMN "authorLastReadAt" TIMESTAMP(3),
ADD COLUMN "lastStaffMessageAt" TIMESTAMP(3);

CREATE INDEX "support_requests_authorId_lastStaffMessageAt_idx"
ON "public"."support_requests"("authorId", "lastStaffMessageAt");
