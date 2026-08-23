-- Add an optional private email address to user accounts.
ALTER TABLE "public"."users"
    ADD COLUMN IF NOT EXISTS "email" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key"
    ON "public"."users"("email");
