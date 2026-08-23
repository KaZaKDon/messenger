import test from "node:test";
import assert from "node:assert/strict";
import { listPrivateDialogsDb } from "../chat.socket.js";

test("private dialog list restores only chats with messages after the personal clear point", async () => {
    const clearedAt = new Date("2026-08-22T08:00:00.000Z");
    const messageQueries = [];
    const db = {
        userBlock: { findMany: async () => [] },
        chatMember: {
            findMany: async () => [
                {
                    clearedAt: null,
                    chat: {
                        id: "room-user-1-user-2",
                        type: "private",
                        members: [
                            { user: { id: "user-1", name: "Первый", phone: "+70000000001", avatar: null } },
                            { user: { id: "user-2", name: "Второй", phone: "+70000000002", avatar: null } },
                        ],
                    },
                },
                {
                    clearedAt,
                    chat: {
                        id: "room-user-1-user-3",
                        type: "private",
                        members: [
                            { user: { id: "user-1", name: "Первый", phone: "+70000000001", avatar: null } },
                            { user: { id: "user-3", name: "Третий", phone: "+70000000003", avatar: null } },
                        ],
                    },
                },
            ],
        },
        message: {
            count: async () => 1,
            findFirst: async (query) => {
                messageQueries.push(query);
                if (query.where.chatId === "room-user-1-user-3") return null;
                return {
                    id: "message-1",
                    chatId: "room-user-1-user-2",
                    senderId: "user-2",
                    text: "Видео",
                    type: "media",
                    imageUrl: null,
                    imageUrls: null,
                    attachments: [{ id: "attachment-1", mediaType: "video", url: "/uploads/clip.mp4" }],
                    status: "delivered",
                    createdAt: new Date("2026-08-22T09:00:00.000Z"),
                };
            },
        },
    };

    const dialogs = await listPrivateDialogsDb("user-1", db);

    assert.equal(dialogs.length, 1);
    assert.equal(dialogs[0].chatId, "room-user-1-user-2");
    assert.equal(dialogs[0].otherUser.id, "user-2");
    assert.equal(dialogs[0].messages[0].attachments[0].mediaType, "video");
    assert.equal(dialogs[0].unreadCount, 1);
    assert.deepEqual(messageQueries[1].where.createdAt, { gt: clearedAt });
});
