-- Add the moderator role without changing existing user assignments.
ALTER TYPE "public"."UserRole"
ADD VALUE IF NOT EXISTS 'moderator' BEFORE 'admin';
