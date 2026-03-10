CREATE TYPE "MessageType" AS ENUM ('text', 'media', 'service');
CREATE TYPE "MediaType" AS ENUM ('image', 'audio', 'video', 'file');
CREATE TYPE "CallType" AS ENUM ('audio', 'video');
CREATE TYPE "CallStatus" AS ENUM ('initiated', 'ringing', 'connected', 'ended', 'failed', 'missed');

ALTER TABLE "messages"
ADD COLUMN "type" "MessageType" NOT NULL DEFAULT 'text';

CREATE TABLE "message_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "durationMs" INTEGER,
    "waveform" JSONB,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "call_sessions" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "type" "CallType" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'initiated',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "endedReason" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "message_attachments_messageId_idx" ON "message_attachments"("messageId");
CREATE INDEX "message_attachments_mediaType_idx" ON "message_attachments"("mediaType");

CREATE INDEX "call_sessions_chatId_createdAt_idx" ON "call_sessions"("chatId", "createdAt");
CREATE INDEX "call_sessions_initiatorId_createdAt_idx" ON "call_sessions"("initiatorId", "createdAt");

CREATE UNIQUE INDEX "call_sessions_messageId_key" ON "call_sessions"("messageId");

ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
