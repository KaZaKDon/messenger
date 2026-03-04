import test from "node:test";
import assert from "node:assert/strict";

import { chatSocket } from "../chat.socket.js";
import { prisma } from "../../db/prisma.js";

function createFakeSocket(userId = "user-1") {
    return {
        data: {
            isAuth: true,
            userId,
            userName: "Test User",
        },
        rooms: new Set(),
        handlers: new Map(),
        emitted: [],
        on(event, handler) {
            this.handlers.set(event, handler);
        },
        emit(event, payload) {
            this.emitted.push({ event, payload });
        },
        join(roomId) {
            this.rooms.add(roomId);
        },
    };
}

function createFakeIo() {
    return {
        to() {
            return {
                emit() {},
            };
        },
    };
}

test("chat:history returns paginated payload (happy-path)", async () => {
    const socket = createFakeSocket();
    chatSocket(createFakeIo(), socket);

    const originalChatFindFirst = prisma.chat.findFirst;
    const originalMessageFindMany = prisma.message.findMany;

    prisma.chat.findFirst = async () => ({ id: "group-11" });
    prisma.message.findMany = async () =>
        Array.from({ length: 51 }, (_, i) => ({
            id: `m-${i + 1}`,
            chatId: "group-11",
            senderId: "user-1",
            text: `message-${i + 1}`,
            imageUrl: null,
            imageUrls: null,
            status: "sent",
            createdAt: new Date(Date.now() - i * 1000),
        }));

    try {
        const handler = socket.handlers.get("chat:history");
        assert.ok(handler, "chat:history handler should be registered");

        await handler({ chatId: "group-11" });

        const event = socket.emitted.find((item) => item.event === "chat:history");
        assert.ok(event, "chat:history should be emitted");
        assert.equal(event.payload.chatId, "group-11");
        assert.equal(event.payload.hasMoreHistory, true);
        assert.equal(event.payload.messages.length, 50);
    } finally {
        prisma.chat.findFirst = originalChatFindFirst;
        prisma.message.findMany = originalMessageFindMany;
    }
});

test("chat:history emits chat:error on db failure (degraded-path)", async () => {
    const socket = createFakeSocket();
    chatSocket(createFakeIo(), socket);

    const originalChatFindFirst = prisma.chat.findFirst;
    prisma.chat.findFirst = async () => {
        throw new Error("db unavailable");
    };

    try {
        const handler = socket.handlers.get("chat:history");
        assert.ok(handler, "chat:history handler should be registered");

        await handler({ chatId: "group-11" });

        const event = socket.emitted.find((item) => item.event === "chat:error");
        assert.ok(event, "chat:error should be emitted on db failure");
        assert.equal(event.payload.message, "Chat history is temporarily unavailable");
    } finally {
        prisma.chat.findFirst = originalChatFindFirst;
    }
});
