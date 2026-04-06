import test from "node:test";
import assert from "node:assert/strict";

import { callSocket } from "../call.socket.js";
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
        delivered: [],
        to(sid) {
            return {
                emit: (event, payload) => {
                    this.delivered.push({ sid, event, payload });
                },
            };
        },
    };
}

test("call:start emits call:started and call:ringing for caller", async () => {
    const socket = createFakeSocket("user-1");
    const io = createFakeIo();
    callSocket(io, socket);

    const originalChatFindFirst = prisma.chat.findFirst;
    const originalCallFindFirst = prisma.callSession.findFirst;
    const originalCallCreate = prisma.callSession.create;
    const originalCallUpdate = prisma.callSession.update;

    prisma.chat.findFirst = async () => ({
        members: [{ userId: "user-1" }, { userId: "user-2" }],
    });
    prisma.callSession.findFirst = async () => null;
    prisma.callSession.create = async () => ({
        id: "call-1",
        chatId: "room-1",
        initiatorId: "user-1",
        type: "audio",
        status: "initiated",
        startedAt: null,
        endedAt: null,
        durationSec: null,
        endedReason: null,
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
        updatedAt: new Date("2026-04-05T10:00:00.000Z"),
    });
    prisma.callSession.update = async () => ({
        id: "call-1",
    });

    try {
        const handler = socket.handlers.get("call:start");
        assert.ok(handler, "call:start handler should be registered");

        await handler({ chatId: "room-1", type: "audio" });

        const started = socket.emitted.find((event) => event.event === "call:started");
        assert.ok(started, "call:started should be emitted");
        assert.equal(started.payload.callId, "call-1");

        const ringing = socket.emitted.find((event) => event.event === "call:ringing");
        assert.ok(ringing, "call:ringing should be emitted");
        assert.equal(ringing.payload.status, "ringing");
    } finally {
        prisma.chat.findFirst = originalChatFindFirst;
        prisma.callSession.findFirst = originalCallFindFirst;
        prisma.callSession.create = originalCallCreate;
        prisma.callSession.update = originalCallUpdate;
    }
});

test("call:signal rejects invalid signal kind", async () => {
    const socket = createFakeSocket("user-1");
    callSocket(createFakeIo(), socket);

    const handler = socket.handlers.get("call:signal");
    assert.ok(handler, "call:signal handler should be registered");

    await handler({ callId: "call-1", chatId: "room-1", kind: "bad-kind" });

    const error = socket.emitted.find((event) => event.event === "call:error");
    assert.ok(error, "call:error should be emitted");
    assert.equal(error.payload.code, "INVALID_SIGNAL_KIND");
});

test("call:history:get emits call:history page", async () => {
    const socket = createFakeSocket("user-1");
    callSocket(createFakeIo(), socket);

    const originalChatFindFirst = prisma.chat.findFirst;
    const originalCallFindMany = prisma.callSession.findMany;

    prisma.chat.findFirst = async () => ({
        members: [{ userId: "user-1" }, { userId: "user-2" }],
    });
    prisma.callSession.findMany = async () => [
        {
            id: "call-2",
            chatId: "room-1",
            initiatorId: "user-1",
            type: "video",
            status: "ended",
            startedAt: new Date("2026-04-05T10:01:00.000Z"),
            endedAt: new Date("2026-04-05T10:03:00.000Z"),
            durationSec: 120,
            endedReason: "hangup",
            createdAt: new Date("2026-04-05T10:01:00.000Z"),
            updatedAt: new Date("2026-04-05T10:03:00.000Z"),
        },
    ];

    try {
        const handler = socket.handlers.get("call:history:get");
        assert.ok(handler, "call:history:get handler should be registered");

        await handler({ chatId: "room-1", limit: 10 });

        const history = socket.emitted.find((event) => event.event === "call:history");
        assert.ok(history, "call:history should be emitted");
        assert.equal(history.payload.items.length, 1);
        assert.equal(history.payload.items[0].callId, "call-2");
    } finally {
        prisma.chat.findFirst = originalChatFindFirst;
        prisma.callSession.findMany = originalCallFindMany;
    }
});

