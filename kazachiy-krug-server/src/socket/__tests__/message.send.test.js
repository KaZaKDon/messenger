import test from "node:test";
import assert from "node:assert/strict";

import { messageSocket } from "../message.socket.js";
import { prisma } from "../../db/prisma.js";

function createFakeSocket(userId = "user-1") {
    return {
        data: {
            isAuth: true,
            userId,
            userName: "Test User",
        },
        handlers: new Map(),
        emitted: [],
        on(event, handler) {
            this.handlers.set(event, handler);
        },
        emit(event, payload) {
            this.emitted.push({ event, payload });
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

test("message:send rejects readonly group publish when user not in publishUserIds", async () => {
    const socket = createFakeSocket("user-1");
    messageSocket(createFakeIo(), socket);

    const originalChatFindFirst = prisma.chat.findFirst;
    const originalGroupRuleFindUnique = prisma.groupRule.findUnique;
    const originalMessageCreate = prisma.message.create;

    let createCalled = false;

    prisma.chat.findFirst = async () => ({
        id: "group-1",
        type: "group",
        members: [{ userId: "user-1" }, { userId: "user-2" }],
    });
    prisma.groupRule.findUnique = async () => ({
        mode: "readonly",
        requiresAnnouncementWithImage: false,
        publishUserIds: ["user-2"],
    });
    prisma.message.create = async () => {
        createCalled = true;
        throw new Error("should not create");
    };

    try {
        const handler = socket.handlers.get("message:send");
        assert.ok(handler, "message:send handler should be registered");

        await handler({ id: "m-1", chatId: "group-1", text: "hello" });

        const errorEvent = socket.emitted.find((item) => item.event === "message:error");
        assert.ok(errorEvent, "message:error should be emitted");
        assert.equal(errorEvent.payload.reason, "У вас нет прав на публикацию в этой группе.");
        assert.equal(createCalled, false, "prisma.message.create must not be called");
    } finally {
        prisma.chat.findFirst = originalChatFindFirst;
        prisma.groupRule.findUnique = originalGroupRuleFindUnique;
        prisma.message.create = originalMessageCreate;
    }
});

test("message:send rejects announcements without image when required", async () => {
    const socket = createFakeSocket("user-1");
    messageSocket(createFakeIo(), socket);

    const originalChatFindFirst = prisma.chat.findFirst;
    const originalGroupRuleFindUnique = prisma.groupRule.findUnique;
    const originalMessageCreate = prisma.message.create;

    let createCalled = false;

    prisma.chat.findFirst = async () => ({
        id: "group-4",
        type: "group",
        members: [{ userId: "user-1" }, { userId: "user-2" }],
    });
    prisma.groupRule.findUnique = async () => ({
        mode: "announcements",
        requiresAnnouncementWithImage: true,
        publishUserIds: null,
    });
    prisma.message.create = async () => {
        createCalled = true;
        throw new Error("should not create");
    };

    try {
        const handler = socket.handlers.get("message:send");
        assert.ok(handler, "message:send handler should be registered");

        await handler({ id: "m-2", chatId: "group-4", text: "announcement without image" });

        const errorEvent = socket.emitted.find((item) => item.event === "message:error");
        assert.ok(errorEvent, "message:error should be emitted");
        assert.equal(
            errorEvent.payload.reason,
            "Для групп 4–10 требуется формат: объявление + картинка (text + imageUrl)."
        );
        assert.equal(createCalled, false, "prisma.message.create must not be called");
    } finally {
        prisma.chat.findFirst = originalChatFindFirst;
        prisma.groupRule.findUnique = originalGroupRuleFindUnique;
        prisma.message.create = originalMessageCreate;
    }
});

test("message:send normalizes invalid message type and attachment media type", async () => {
    const socket = createFakeSocket("user-1");
    messageSocket(createFakeIo(), socket);

    const originalChatFindFirst = prisma.chat.findFirst;
    const originalGroupRuleFindUnique = prisma.groupRule.findUnique;
    const originalMessageCreate = prisma.message.create;

    let createPayload = null;

    prisma.chat.findFirst = async () => ({
        id: "group-1",
        type: "group",
        members: [{ userId: "user-1" }, { userId: "user-2" }],
    });
    prisma.groupRule.findUnique = async () => ({
        mode: "chat",
        requiresAnnouncementWithImage: false,
        publishUserIds: null,
    });
    prisma.message.create = async (payload) => {
        createPayload = payload;

        return {
            id: "m-3",
            chatId: "group-1",
            senderId: "user-1",
            text: "voice",
            type: payload.data.type,
            imageUrl: null,
            imageUrls: null,
            attachments: [
                {
                    id: "a-1",
                    mediaType: payload.data.attachments.create[0].mediaType,
                    url: payload.data.attachments.create[0].url,
                    mimeType: payload.data.attachments.create[0].mimeType,
                    sizeBytes: payload.data.attachments.create[0].sizeBytes,
                    durationMs: payload.data.attachments.create[0].durationMs,
                    waveform: payload.data.attachments.create[0].waveform,
                    width: null,
                    height: null,
                },
            ],
            status: "sent",
            createdAt: new Date(),
        };
    };

    try {
        const handler = socket.handlers.get("message:send");
        assert.ok(handler, "message:send handler should be registered");

        await handler({
            id: "m-3",
            chatId: "group-1",
            text: "voice",
            type: "VOICE_NOTE",
            attachments: [
                {
                    mediaType: "AUDIO_NOTE",
                    url: "  /uploads/v1.ogg  ",
                    mimeType: "audio/ogg",
                    sizeBytes: 1234,
                    durationMs: 5400,
                },
            ],
        });

        assert.ok(createPayload, "prisma.message.create should be called");
        assert.equal(createPayload.data.type, "text");
        assert.equal(createPayload.data.attachments.create.length, 1);
        assert.equal(createPayload.data.attachments.create[0].mediaType, "file");
        assert.equal(createPayload.data.attachments.create[0].url, "/uploads/v1.ogg");

        const newEvent = socket.emitted.find((item) => item.event === "message:new");
        assert.ok(newEvent, "message:new should be emitted");
        assert.equal(newEvent.payload.type, "text");
        assert.equal(newEvent.payload.attachments[0].mediaType, "file");
    } finally {
        prisma.chat.findFirst = originalChatFindFirst;
        prisma.groupRule.findUnique = originalGroupRuleFindUnique;
        prisma.message.create = originalMessageCreate;
    }
});

test("message:send keeps allowed media message type and audio attachment", async () => {
    const socket = createFakeSocket("user-1");
    messageSocket(createFakeIo(), socket);

    const originalChatFindFirst = prisma.chat.findFirst;
    const originalGroupRuleFindUnique = prisma.groupRule.findUnique;
    const originalMessageCreate = prisma.message.create;

    let createPayload = null;

    prisma.chat.findFirst = async () => ({
        id: "group-1",
        type: "group",
        members: [{ userId: "user-1" }, { userId: "user-2" }],
    });
    prisma.groupRule.findUnique = async () => ({
        mode: "chat",
        requiresAnnouncementWithImage: false,
        publishUserIds: null,
    });
    prisma.message.create = async (payload) => {
        createPayload = payload;

        return {
            id: "m-4",
            chatId: "group-1",
            senderId: "user-1",
            text: "",
            type: payload.data.type,
            imageUrl: null,
            imageUrls: null,
            attachments: payload.data.attachments.create.map((attachment, idx) => ({
                id: `a-${idx + 1}`,
                ...attachment,
            })),
            status: "sent",
            createdAt: new Date(),
        };
    };

    try {
        const handler = socket.handlers.get("message:send");
        assert.ok(handler, "message:send handler should be registered");

        await handler({
            id: "m-4",
            chatId: "group-1",
            text: "",
            type: "media",
            attachments: [
                {
                    mediaType: "audio",
                    url: "/uploads/v2.ogg",
                    mimeType: "audio/ogg",
                    sizeBytes: 2000,
                    durationMs: 1000,
                },
            ],
        });

        assert.ok(createPayload, "prisma.message.create should be called");
        assert.equal(createPayload.data.type, "media");
        assert.equal(createPayload.data.attachments.create[0].mediaType, "audio");

        const newEvent = socket.emitted.find((item) => item.event === "message:new");
        assert.ok(newEvent, "message:new should be emitted");
        assert.equal(newEvent.payload.type, "media");
        assert.equal(newEvent.payload.attachments[0].mediaType, "audio");
    } finally {
        prisma.chat.findFirst = originalChatFindFirst;
        prisma.groupRule.findUnique = originalGroupRuleFindUnique;
        prisma.message.create = originalMessageCreate;
    }
});

test("message:send allows publish when publishUserIds is empty array and mode=chat", async () => {
    const socket = createFakeSocket("user-1");
    messageSocket(createFakeIo(), socket);

    const originalChatFindFirst = prisma.chat.findFirst;
    const originalGroupRuleFindUnique = prisma.groupRule.findUnique;
    const originalMessageCreate = prisma.message.create;

    let createCalled = false;

    prisma.chat.findFirst = async () => ({
        id: "group-2",
        type: "group",
        members: [{ userId: "user-1" }, { userId: "user-2" }],
    });
    prisma.groupRule.findUnique = async () => ({
        mode: "chat",
        requiresAnnouncementWithImage: false,
        publishUserIds: [],
    });
    prisma.message.create = async () => {
        createCalled = true;
        return {
            id: "m-5",
            chatId: "group-2",
            senderId: "user-1",
            text: "allowed",
            type: "text",
            imageUrl: null,
            imageUrls: null,
            attachments: [],
            status: "sent",
            createdAt: new Date(),
        };
    };

    try {
        const handler = socket.handlers.get("message:send");
        assert.ok(handler, "message:send handler should be registered");

        await handler({ id: "m-5", chatId: "group-2", text: "allowed" });

        assert.equal(createCalled, true, "message should be created when publishUserIds is [] and mode=chat");
        const errorEvent = socket.emitted.find((item) => item.event === "message:error");
        assert.equal(errorEvent, undefined, "message:error should not be emitted");
    } finally {
        prisma.chat.findFirst = originalChatFindFirst;
        prisma.groupRule.findUnique = originalGroupRuleFindUnique;
        prisma.message.create = originalMessageCreate;
    }
});
