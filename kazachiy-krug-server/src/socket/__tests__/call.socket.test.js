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

test("call:signal rate-limits excessive signaling packets", async () => {
    const socket = createFakeSocket("user-1");
    const io = createFakeIo();
    callSocket(io, socket);

    const originalChatFindFirst = prisma.chat.findFirst;
    prisma.chat.findFirst = async () => ({
        members: [{ userId: "user-1" }, { userId: "user-2" }],
    });

    try {
        const handler = socket.handlers.get("call:signal");
        assert.ok(handler, "call:signal handler should be registered");

        for (let i = 0; i < 65; i += 1) {
            await handler({
                callId: "call-1",
                chatId: "room-1",
                kind: "ice-candidate",
                candidate: { candidate: `cand-${i}`, sdpMid: "0", sdpMLineIndex: 0 },
            });
        }

        const rateLimitError = socket.emitted.find(
            (event) => event.event === "call:error" && event.payload?.code === "CALL_SIGNAL_RATE_LIMIT"
        );
        assert.ok(rateLimitError, "rate-limit error should be emitted");
    } finally {
        prisma.chat.findFirst = originalChatFindFirst;
    }
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

test("call:start can be retried after timeout marks ringing DB call as missed", async () => {
    const socket = createFakeSocket("user-1");
    const io = createFakeIo();
    callSocket(io, socket);

    const originalSetTimeout = global.setTimeout;
    const originalChatFindFirst = prisma.chat.findFirst;
    const originalCallFindFirst = prisma.callSession.findFirst;
    const originalCallFindUnique = prisma.callSession.findUnique;
    const originalCallCreate = prisma.callSession.create;
    const originalCallUpdate = prisma.callSession.update;

    let scheduledTimeoutCallback = null;
    let callSeq = 0;
    let callState = null;

    global.setTimeout = (callback) => {
        scheduledTimeoutCallback = callback;
        return 1;
    };

    prisma.chat.findFirst = async () => ({
        members: [{ userId: "user-1" }, { userId: "user-2" }],
    });
    prisma.callSession.findFirst = async () => (
        callState && ["initiated", "ringing", "connected"].includes(callState.status)
            ? { id: callState.id }
            : null
    );
    prisma.callSession.findUnique = async () => callState;
    prisma.callSession.create = async ({ data }) => {
        callSeq += 1;
        const now = new Date(`2026-04-05T10:0${callSeq}:00.000Z`);
        callState = {
            id: `call-${callSeq}`,
            chatId: data.chatId,
            initiatorId: data.initiatorId,
            type: data.type,
            status: "initiated",
            startedAt: null,
            endedAt: null,
            durationSec: null,
            endedReason: null,
            createdAt: now,
            updatedAt: now,
        };
        return callState;
    };
    prisma.callSession.update = async ({ where, data }) => {
        assert.equal(where.id, callState?.id);
        callState = {
            ...callState,
            ...data,
            updatedAt: new Date("2026-04-05T10:10:00.000Z"),
        };
        return callState;
    };

    try {
        const startHandler = socket.handlers.get("call:start");
        assert.ok(startHandler, "call:start handler should be registered");

        await startHandler({ chatId: "room-1", type: "audio", targetUserId: "user-2" });
        assert.equal(callState?.status, "ringing", "first call should become ringing");
        assert.ok(scheduledTimeoutCallback, "ring timeout callback should be scheduled");

        await scheduledTimeoutCallback();
        assert.equal(callState?.status, "missed", "timeout should mark call as missed");

        socket.emitted = [];
        await startHandler({ chatId: "room-1", type: "audio", targetUserId: "user-2" });

        const activeCallError = socket.emitted.find(
            (event) => event.event === "call:error" && event.payload?.code === "CALL_ALREADY_EXISTS_ACTIVE"
        );
        assert.equal(activeCallError, undefined, "retry should not fail with active-call error");

        const restarted = socket.emitted.find((event) => event.event === "call:started");
        assert.ok(restarted, "second call attempt should start successfully");
    } finally {
        global.setTimeout = originalSetTimeout;
        prisma.chat.findFirst = originalChatFindFirst;
        prisma.callSession.findFirst = originalCallFindFirst;
        prisma.callSession.findUnique = originalCallFindUnique;
        prisma.callSession.create = originalCallCreate;
        prisma.callSession.update = originalCallUpdate;
    }
});

test("call:start auto-clears stale ringing call before creating a new one", async () => {
    const socket = createFakeSocket("user-1");
    callSocket(createFakeIo(), socket);

    const originalChatFindFirst = prisma.chat.findFirst;
    const originalCallFindFirst = prisma.callSession.findFirst;
    const originalCallCreate = prisma.callSession.create;
    const originalCallUpdate = prisma.callSession.update;

    let findFirstCalls = 0;
    const staleUpdatedAt = new Date(Date.now() - 60_000).toISOString();
    let newCallCreated = false;

    prisma.chat.findFirst = async () => ({
        members: [{ userId: "user-1" }, { userId: "user-2" }],
    });
    prisma.callSession.findFirst = async () => {
        findFirstCalls += 1;
        if (findFirstCalls === 1) {
            return {
                id: "stale-call-1",
                chatId: "room-1",
                initiatorId: "user-2",
                type: "audio",
                status: "ringing",
                startedAt: null,
                endedAt: null,
                durationSec: null,
                endedReason: null,
                createdAt: staleUpdatedAt,
                updatedAt: staleUpdatedAt,
            };
        }
        return null;
    };
    prisma.callSession.update = async ({ where, data }) => {
        assert.equal(where.id, "stale-call-1");
        assert.equal(data.status, "missed");
        assert.equal(data.endedReason, "timeout");
        return {
            id: "stale-call-1",
            chatId: "room-1",
            status: "missed",
        };
    };
    prisma.callSession.create = async ({ data }) => {
        newCallCreated = true;
        return {
            id: "call-new",
            chatId: data.chatId,
            initiatorId: data.initiatorId,
            type: data.type,
            status: "initiated",
            startedAt: null,
            endedAt: null,
            durationSec: null,
            endedReason: null,
            createdAt: new Date("2026-04-05T10:15:00.000Z"),
            updatedAt: new Date("2026-04-05T10:15:00.000Z"),
        };
    };

    try {
        const startHandler = socket.handlers.get("call:start");
        assert.ok(startHandler, "call:start handler should be registered");

        await startHandler({ chatId: "room-1", type: "audio", targetUserId: "user-2" });

        const activeCallError = socket.emitted.find(
            (event) => event.event === "call:error" && event.payload?.code === "CALL_ALREADY_EXISTS_ACTIVE"
        );
        assert.equal(activeCallError, undefined, "stale active call should not block a new start");
        assert.equal(newCallCreated, true, "new call should be created after stale call cleanup");
    } finally {
        prisma.chat.findFirst = originalChatFindFirst;
        prisma.callSession.findFirst = originalCallFindFirst;
        prisma.callSession.create = originalCallCreate;
        prisma.callSession.update = originalCallUpdate;
    }
});

test("call:start returns active call payload when chat already has active call", async () => {
    const socket = createFakeSocket("user-1");
    callSocket(createFakeIo(), socket);

    const originalChatFindFirst = prisma.chat.findFirst;
    const originalCallFindFirst = prisma.callSession.findFirst;

    prisma.chat.findFirst = async () => ({
        members: [{ userId: "user-1" }, { userId: "user-2" }],
    });
    prisma.callSession.findFirst = async () => ({
        id: "call-existing-1",
        chatId: "room-1",
        initiatorId: "user-2",
        type: "audio",
        status: "ringing",
        startedAt: null,
        endedAt: null,
        durationSec: null,
        endedReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    try {
        const startHandler = socket.handlers.get("call:start");
        assert.ok(startHandler, "call:start handler should be registered");

        await startHandler({ chatId: "room-1", type: "audio", targetUserId: "user-2" });

        const error = socket.emitted.find(
            (event) => event.event === "call:error" && event.payload?.code === "CALL_ALREADY_EXISTS_ACTIVE"
        );
        assert.ok(error, "active-call error should be emitted");
        assert.equal(error.payload.callId, "call-existing-1");
        assert.equal(error.payload.activeCall?.callId, "call-existing-1");
        assert.equal(error.payload.activeCall?.status, "ringing");
    } finally {
        prisma.chat.findFirst = originalChatFindFirst;
        prisma.callSession.findFirst = originalCallFindFirst;
    }
});
