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
