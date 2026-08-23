-- Group visibility is evaluated inside the authenticated messenger.
-- "public" means visible to every active platform user; "private" means
-- visible only to explicitly added chat members.
CREATE TYPE "public"."GroupVisibility" AS ENUM ('public', 'private');

-- Publishing rights are configured independently from a group's content mode.
CREATE TYPE "public"."GroupPublishPolicy" AS ENUM (
    'members',
    'selected_authors',
    'admin_moderator',
    'owner',
    'admin'
);

CREATE TYPE "public"."GroupStatus" AS ENUM ('active', 'disabled', 'archived');

ALTER TABLE "public"."group_rules"
ADD COLUMN "visibility" "public"."GroupVisibility" NOT NULL DEFAULT 'public',
ADD COLUMN "publishPolicy" "public"."GroupPublishPolicy" NOT NULL DEFAULT 'members',
ADD COLUMN "status" "public"."GroupStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "ownerId" TEXT,
ADD COLUMN "ownershipStartsAt" TIMESTAMP(3),
ADD COLUMN "ownershipEndsAt" TIMESTAMP(3);

-- Selected publishers are normalized into a relation. The legacy JSON field
-- remains temporarily so the current socket layer keeps working unchanged.
CREATE TABLE "public"."group_publishers" (
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_publishers_pkey" PRIMARY KEY ("chatId", "userId")
);

-- Apply the agreed configuration without assigning new users or owners.
UPDATE "public"."group_rules"
SET "publishPolicy" = 'admin_moderator'
WHERE "chatId" = 'group-1';

UPDATE "public"."group_rules"
SET "publishPolicy" = 'selected_authors'
WHERE "chatId" IN ('group-2', 'group-3');

UPDATE "public"."group_rules"
SET "visibility" = 'private'
WHERE "chatId" = 'group-13';

CREATE INDEX "group_rules_ownerId_idx"
ON "public"."group_rules"("ownerId");

CREATE INDEX "group_rules_status_idx"
ON "public"."group_rules"("status");

CREATE INDEX "group_rules_ownershipEndsAt_idx"
ON "public"."group_rules"("ownershipEndsAt");

CREATE INDEX "group_publishers_userId_idx"
ON "public"."group_publishers"("userId");

ALTER TABLE "public"."group_rules"
ADD CONSTRAINT "group_rules_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."group_publishers"
ADD CONSTRAINT "group_publishers_chatId_fkey"
FOREIGN KEY ("chatId") REFERENCES "public"."group_rules"("chatId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."group_publishers"
ADD CONSTRAINT "group_publishers_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."group_rules"
ADD CONSTRAINT "group_rules_ownership_period_check"
CHECK (
    "ownershipStartsAt" IS NULL
    OR "ownershipEndsAt" IS NULL
    OR "ownershipEndsAt" > "ownershipStartsAt"
);
