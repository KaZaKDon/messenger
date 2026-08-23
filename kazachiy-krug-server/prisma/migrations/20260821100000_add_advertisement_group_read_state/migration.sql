CREATE TABLE "advertisement_group_reads" (
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advertisement_group_reads_pkey" PRIMARY KEY ("userId", "chatId")
);

CREATE INDEX "advertisement_group_reads_chatId_lastReadAt_idx"
ON "advertisement_group_reads"("chatId", "lastReadAt");

ALTER TABLE "advertisement_group_reads"
ADD CONSTRAINT "advertisement_group_reads_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "advertisement_group_reads"
ADD CONSTRAINT "advertisement_group_reads_chatId_fkey"
FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
