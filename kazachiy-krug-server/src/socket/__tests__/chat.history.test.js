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

test("chat:history falls back to legacy message select when media fields are unavailable", async () => {
    const socket = createFakeSocket();
    chatSocket(createFakeIo(), socket);

    const originalChatFindFirst = prisma.chat.findFirst;
    const originalMessageFindMany = prisma.message.findMany;

    const findManyPayloads = [];

    prisma.chat.findFirst = async () => ({ id: "room-user-1-user-4" });
    prisma.message.findMany = async (payload) => {
        findManyPayloads.push(payload);

        if (payload.select.type) {
            throw new Error("Unknown field `type` for select statement on model `Message`.");
        }

        return [
            {
                id: "m-legacy-history",
                chatId: "room-user-1-user-4",
                senderId: "user-1",
                text: "legacy",
                imageUrl: null,
                imageUrls: null,
                status: "sent",
                createdAt: new Date("2026-05-11T12:00:00.000Z"),
            },
        ];
    };

    try {
        const handler = socket.handlers.get("chat:history");
        assert.ok(handler, "chat:history handler should be registered");

        await handler({ chatId: "room-user-1-user-4" });

        assert.equal(findManyPayloads.length, 2, "history query should be retried without media fields");
        assert.equal(findManyPayloads[0].select.type, true);
        assert.equal(findManyPayloads[1].select.type, undefined);
        assert.equal(findManyPayloads[1].select.attachments, undefined);

        const event = socket.emitted.find((item) => item.event === "chat:history");
        assert.ok(event, "chat:history should be emitted after legacy select fallback");
        assert.equal(event.payload.messages[0].id, "m-legacy-history");
        assert.equal(event.payload.messages[0].type, "text");
        assert.deepEqual(event.payload.messages[0].attachments, []);
    } finally {
        prisma.chat.findFirst = originalChatFindFirst;
        prisma.message.findMany = originalMessageFindMany;
    }
});

test("chat:history maps legacy audio URL to audio attachment", async () => {
    const socket = createFakeSocket();
    chatSocket(createFakeIo(), socket);

    const originalChatFindFirst = prisma.chat.findFirst;
    const originalMessageFindMany = prisma.message.findMany;

    prisma.chat.findFirst = async () => ({ id: "room-user-1-user-4" });
    prisma.message.findMany = async (payload) => {
        if (payload.select.type) {
            throw new Error("Unknown field `type` for select statement on model `Message`.");
        }

        return [
            {
                id: "m-legacy-voice-history",
                chatId: "room-user-1-user-4",
                senderId: "user-1",
                text: "",
                imageUrl: "http://localhost:3000/uploads/voice.webm",
                imageUrls: null,
                status: "sent",
                createdAt: new Date("2026-05-11T12:00:00.000Z"),
            },
        ];
    };

    try {
        const handler = socket.handlers.get("chat:history");
        assert.ok(handler, "chat:history handler should be registered");

        await handler({ chatId: "room-user-1-user-4" });

        const event = socket.emitted.find((item) => item.event === "chat:history");
        assert.ok(event, "chat:history should be emitted");
        assert.equal(event.payload.messages[0].type, "media");
        assert.equal(event.payload.messages[0].attachments[0].mediaType, "audio");
        assert.equal(event.payload.messages[0].attachments[0].url, "http://localhost:3000/uploads/voice.webm");
    } finally {
        prisma.chat.findFirst = originalChatFindFirst;
        prisma.message.findMany = originalMessageFindMany;
    }
});
