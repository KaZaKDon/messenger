import { prisma } from "../db/prisma.js";
import { chats } from "../store/chats.js";
import { onlineUsers } from "../store/onlineUsers.js";
import { CALL_MEMORY_FALLBACK_ENABLED } from "../config/runtimeFlags.js";
import { getCallById, listCallsByChatId, upsertCall } from "../store/calls.js";
import { getOrCreatePrivateChat } from "../store/chatHelpers.js";

const RING_TIMEOUT_MS = 30_000;
const ACTIVE_STATUSES = new Set(["initiated", "ringing", "connected"]);
const CALL_TYPES = new Set(["audio", "video"]);
const SIGNAL_KINDS = new Set(["offer", "answer", "ice-candidate"]);

function getNowIso() {
    return new Date().toISOString();
}

function emitCallError(socket, payload = {}) {
    socket.emit("call:error", {
        code: payload.code ?? "INTERNAL_ERROR",
        message: payload.message ?? "Call service error",
        callId: payload.callId ?? null,
        chatId: payload.chatId ?? null,
        retryable: Boolean(payload.retryable),
    });
}

function emitToMembers(io, memberIds, eventName, payload) {
    for (const memberId of memberIds) {
        const sid = onlineUsers.get(memberId);
        if (!sid) continue;
        io.to(sid).emit(eventName, payload);
    }
}

function normalizeLimit(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 20;
    return Math.min(Math.trunc(n), 100);
}

async function getChatMemberIdsDb(chatId, userId) {
    const chat = await prisma.chat.findFirst({
        where: {
            id: chatId,
            members: {
                some: { userId },
            },
        },
        select: {
            members: {
                select: { userId: true },
            },
        },
    });

    return chat?.members?.map((member) => member.userId) ?? null;
}

async function ensurePrivateChatMembershipDb(currentUserId, targetUserId) {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return null;
    const chatId = `room-${[currentUserId, targetUserId].sort().join("-")}`;

    await prisma.chat.upsert({
        where: { id: chatId },
        update: { type: "private", title: null },
        create: { id: chatId, type: "private", title: null },
    });

    await prisma.chatMember.upsert({
        where: {
            chatId_userId: { chatId, userId: currentUserId },
        },
        update: {},
        create: { chatId, userId: currentUserId, role: "member" },
    });

    await prisma.chatMember.upsert({
        where: {
            chatId_userId: { chatId, userId: targetUserId },
        },
        update: {},
        create: { chatId, userId: targetUserId, role: "member" },
    });

    return chatId;
}

function getChatMemberIdsMemory(chatId, userId) {
    const chat = chats[chatId];
    if (!chat?.members?.includes(userId)) return null;
    return chat.members;
}

function hasActiveCallInChatMemory(chatId) {
    return listCallsByChatId(chatId).some((call) => ACTIVE_STATUSES.has(call.status));
}

async function hasActiveCallInChatDb(chatId) {
    const active = await prisma.callSession.findFirst({
        where: {
            chatId,
            status: {
                in: [...ACTIVE_STATUSES],
            },
        },
        select: { id: true },
    });
    return Boolean(active?.id);
}

async function createCallDb({ chatId, initiatorId, type }) {
    return prisma.callSession.create({
        data: {
            chatId,
            initiatorId,
            type,
            status: "initiated",
        },
    });
}

async function findCallDb(callId) {
    return prisma.callSession.findUnique({
        where: { id: callId },
    });
}

async function updateCallDb(callId, data) {
    return prisma.callSession.update({
        where: { id: callId },
        data,
    });
}

function serializeCall(call) {
    return {
        callId: call.id,
        chatId: call.chatId,
        type: call.type,
        initiatorId: call.initiatorId,
        status: call.status,
        startedAt: call.startedAt ?? null,
        endedAt: call.endedAt ?? null,
        durationSec: call.durationSec ?? null,
        endedReason: call.endedReason ?? null,
        createdAt: call.createdAt ?? getNowIso(),
        updatedAt: call.updatedAt ?? call.createdAt ?? getNowIso(),
    };
}

function createCallMemory({ chatId, initiatorId, type }) {
    const now = getNowIso();
    const call = {
        id: `call-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        chatId,
        initiatorId,
        type,
        status: "initiated",
        startedAt: null,
        endedAt: null,
        durationSec: null,
        endedReason: null,
        createdAt: now,
        updatedAt: now,
    };
    return upsertCall(call);
}

function updateCallMemory(callId, data) {
    const existing = getCallById(callId);
    if (!existing) return null;
    const next = {
        ...existing,
        ...data,
        updatedAt: getNowIso(),
    };
    return upsertCall(next);
}

function durationSecFrom(startedAt, endedAt) {
    if (!startedAt || !endedAt) return 0;
    const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return 0;
    return Math.floor(ms / 1000);
}

function scheduleMissedTimeout({ io, callId, memberIds }) {
    setTimeout(async () => {
        const call = getCallById(callId);
        if (!call || call.status !== "ringing") return;

        const endedAt = getNowIso();
        const next = updateCallMemory(callId, {
            status: "missed",
            endedReason: "timeout",
            endedAt,
            durationSec: 0,
        });
        if (!next) return;

        emitToMembers(io, memberIds, "call:ended", {
            ...serializeCall(next),
            status: "ended",
            endedBy: null,
        });
    }, RING_TIMEOUT_MS);
}

export function callSocket(io, socket) {
    socket.on("call:start", async ({ chatId, type, targetUserId } = {}) => {
        if (!socket.data.isAuth) {
            emitCallError(socket, { code: "UNAUTHORIZED", message: "Authorization required", chatId });
            return;
        }
        if (!chatId || typeof chatId !== "string") {
            emitCallError(socket, { code: "INVALID_PAYLOAD", message: "chatId is required" });
            return;
        }
        if (!CALL_TYPES.has(type)) {
            emitCallError(socket, { code: "INVALID_CALL_TYPE", message: "Invalid call type", chatId });
            return;
        }

        let memberIds = null;
        let call = null;

        try {
            memberIds = await getChatMemberIdsDb(chatId, socket.data.userId);
            if (!memberIds && targetUserId) {
                await ensurePrivateChatMembershipDb(socket.data.userId, targetUserId);
                memberIds = await getChatMemberIdsDb(chatId, socket.data.userId);
            }
            if (!memberIds) {
                emitCallError(socket, {
                    code: "FORBIDDEN_CHAT_ACCESS",
                    message: "No access to chat",
                    chatId,
                });
                return;
            }

            if (await hasActiveCallInChatDb(chatId)) {
                emitCallError(socket, {
                    code: "CALL_ALREADY_EXISTS_ACTIVE",
                    message: "There is already an active call in this chat",
                    chatId,
                    retryable: true,
                });
                return;
            }

            call = await createCallDb({
                chatId,
                initiatorId: socket.data.userId,
                type,
            });
        } catch (error) {
            if (!CALL_MEMORY_FALLBACK_ENABLED) {
                emitCallError(socket, {
                    code: "INTERNAL_ERROR",
                    message: "Call service is temporarily unavailable",
                    chatId,
                });
                return;
            }

            memberIds = getChatMemberIdsMemory(chatId, socket.data.userId);
            if (!memberIds && targetUserId) {
                const privateChat = getOrCreatePrivateChat(socket.data.userId, targetUserId);
                memberIds = privateChat?.members ?? null;
            }
            if (!memberIds) {
                emitCallError(socket, {
                    code: "FORBIDDEN_CHAT_ACCESS",
                    message: "No access to chat",
                    chatId,
                });
                return;
            }
            if (hasActiveCallInChatMemory(chatId)) {
                emitCallError(socket, {
                    code: "CALL_ALREADY_EXISTS_ACTIVE",
                    message: "There is already an active call in this chat",
                    chatId,
                    retryable: true,
                });
                return;
            }
            call = createCallMemory({ chatId, initiatorId: socket.data.userId, type });
        }

        const initiatedPayload = serializeCall(call);
        socket.emit("call:started", initiatedPayload);

        const ringingAt = getNowIso();
        const ringingPayload = {
            ...initiatedPayload,
            status: "ringing",
            ringingAt,
        };

        const peers = memberIds.filter((id) => id !== socket.data.userId);
        emitToMembers(io, peers, "call:incoming", {
            ...ringingPayload,
            fromUserId: socket.data.userId,
            expiresAt: new Date(Date.now() + RING_TIMEOUT_MS).toISOString(),
        });
        socket.emit("call:ringing", ringingPayload);

        try {
            await updateCallDb(call.id, { status: "ringing" });
        } catch {
            if (CALL_MEMORY_FALLBACK_ENABLED) {
                updateCallMemory(call.id, { status: "ringing" });
            }
        }

        if (CALL_MEMORY_FALLBACK_ENABLED && getCallById(call.id)) {
            scheduleMissedTimeout({ io, callId: call.id, memberIds });
        }
    });

    socket.on("call:accept", async ({ callId } = {}) => {
        if (!socket.data.isAuth) {
            emitCallError(socket, { code: "UNAUTHORIZED", message: "Authorization required", callId });
            return;
        }
        if (!callId || typeof callId !== "string") {
            emitCallError(socket, { code: "INVALID_PAYLOAD", message: "callId is required" });
            return;
        }

        let call = null;
        let memberIds = null;
        const startedAt = getNowIso();

        try {
            call = await findCallDb(callId);
            if (!call) {
                emitCallError(socket, { code: "CALL_NOT_FOUND", message: "Call not found", callId });
                return;
            }
            memberIds = await getChatMemberIdsDb(call.chatId, socket.data.userId);
            if (!memberIds) {
                emitCallError(socket, {
                    code: "FORBIDDEN_CHAT_ACCESS",
                    message: "No access to chat",
                    callId,
                    chatId: call.chatId,
                });
                return;
            }
            if (call.status !== "ringing" && call.status !== "initiated") {
                emitCallError(socket, {
                    code: "FORBIDDEN_CALL_ACTION",
                    message: "Call is not in ringing state",
                    callId,
                    chatId: call.chatId,
                });
                return;
            }
            call = await updateCallDb(callId, {
                status: "connected",
                startedAt,
            });
        } catch {
            if (!CALL_MEMORY_FALLBACK_ENABLED) {
                emitCallError(socket, { code: "INTERNAL_ERROR", message: "Call service is unavailable", callId });
                return;
            }
            call = getCallById(callId);
            if (!call) {
                emitCallError(socket, { code: "CALL_NOT_FOUND", message: "Call not found", callId });
                return;
            }
            memberIds = getChatMemberIdsMemory(call.chatId, socket.data.userId);
            if (!memberIds) {
                emitCallError(socket, {
                    code: "FORBIDDEN_CHAT_ACCESS",
                    message: "No access to chat",
                    callId,
                    chatId: call.chatId,
                });
                return;
            }
            if (call.status !== "ringing" && call.status !== "initiated") {
                emitCallError(socket, {
                    code: "FORBIDDEN_CALL_ACTION",
                    message: "Call is not in ringing state",
                    callId,
                    chatId: call.chatId,
                });
                return;
            }
            call = updateCallMemory(callId, {
                status: "connected",
                startedAt,
            });
        }

        emitToMembers(io, memberIds, "call:accepted", {
            ...serializeCall(call),
            acceptedBy: socket.data.userId,
        });
    });

    socket.on("call:decline", async ({ callId, reason = "declined" } = {}) => {
        if (!socket.data.isAuth) {
            emitCallError(socket, { code: "UNAUTHORIZED", message: "Authorization required", callId });
            return;
        }
        if (!callId || typeof callId !== "string") {
            emitCallError(socket, { code: "INVALID_PAYLOAD", message: "callId is required" });
            return;
        }

        let call = null;
        let memberIds = null;
        const endedAt = getNowIso();

        try {
            call = await findCallDb(callId);
            if (!call) {
                emitCallError(socket, { code: "CALL_NOT_FOUND", message: "Call not found", callId });
                return;
            }
            memberIds = await getChatMemberIdsDb(call.chatId, socket.data.userId);
            if (!memberIds) {
                emitCallError(socket, {
                    code: "FORBIDDEN_CHAT_ACCESS",
                    message: "No access to chat",
                    callId,
                    chatId: call.chatId,
                });
                return;
            }
            call = await updateCallDb(callId, {
                status: "ended",
                endedReason: reason,
                endedAt,
                durationSec: durationSecFrom(call.startedAt, endedAt),
            });
        } catch {
            if (!CALL_MEMORY_FALLBACK_ENABLED) {
                emitCallError(socket, { code: "INTERNAL_ERROR", message: "Call service is unavailable", callId });
                return;
            }
            call = getCallById(callId);
            if (!call) {
                emitCallError(socket, { code: "CALL_NOT_FOUND", message: "Call not found", callId });
                return;
            }
            memberIds = getChatMemberIdsMemory(call.chatId, socket.data.userId);
            if (!memberIds) {
                emitCallError(socket, {
                    code: "FORBIDDEN_CHAT_ACCESS",
                    message: "No access to chat",
                    callId,
                    chatId: call.chatId,
                });
                return;
            }
            call = updateCallMemory(callId, {
                status: "ended",
                endedReason: reason,
                endedAt,
                durationSec: durationSecFrom(call.startedAt, endedAt),
            });
        }

        emitToMembers(io, memberIds, "call:declined", {
            ...serializeCall(call),
            declinedBy: socket.data.userId,
            status: "ended",
        });
    });

    socket.on("call:end", async ({ callId, reason = "hangup" } = {}) => {
        if (!socket.data.isAuth) {
            emitCallError(socket, { code: "UNAUTHORIZED", message: "Authorization required", callId });
            return;
        }
        if (!callId || typeof callId !== "string") {
            emitCallError(socket, { code: "INVALID_PAYLOAD", message: "callId is required" });
            return;
        }

        let call = null;
        let memberIds = null;
        const endedAt = getNowIso();

        try {
            call = await findCallDb(callId);
            if (!call) {
                emitCallError(socket, { code: "CALL_NOT_FOUND", message: "Call not found", callId });
                return;
            }
            memberIds = await getChatMemberIdsDb(call.chatId, socket.data.userId);
            if (!memberIds) {
                emitCallError(socket, {
                    code: "FORBIDDEN_CHAT_ACCESS",
                    message: "No access to chat",
                    callId,
                    chatId: call.chatId,
                });
                return;
            }
            if (!ACTIVE_STATUSES.has(call.status)) {
                emitCallError(socket, {
                    code: "CALL_ALREADY_ENDED",
                    message: "Call is already finished",
                    callId,
                    chatId: call.chatId,
                });
                return;
            }
            call = await updateCallDb(callId, {
                status: "ended",
                endedReason: reason,
                endedAt,
                durationSec: durationSecFrom(call.startedAt, endedAt),
            });
        } catch {
            if (!CALL_MEMORY_FALLBACK_ENABLED) {
                emitCallError(socket, { code: "INTERNAL_ERROR", message: "Call service is unavailable", callId });
                return;
            }
            call = getCallById(callId);
            if (!call) {
                emitCallError(socket, { code: "CALL_NOT_FOUND", message: "Call not found", callId });
                return;
            }
            memberIds = getChatMemberIdsMemory(call.chatId, socket.data.userId);
            if (!memberIds) {
                emitCallError(socket, {
                    code: "FORBIDDEN_CHAT_ACCESS",
                    message: "No access to chat",
                    callId,
                    chatId: call.chatId,
                });
                return;
            }
            if (!ACTIVE_STATUSES.has(call.status)) {
                emitCallError(socket, {
                    code: "CALL_ALREADY_ENDED",
                    message: "Call is already finished",
                    callId,
                    chatId: call.chatId,
                });
                return;
            }
            call = updateCallMemory(callId, {
                status: "ended",
                endedReason: reason,
                endedAt,
                durationSec: durationSecFrom(call.startedAt, endedAt),
            });
        }

        emitToMembers(io, memberIds, "call:ended", {
            ...serializeCall(call),
            endedBy: socket.data.userId,
            status: "ended",
        });
    });

    socket.on("call:signal", async ({ callId, chatId, kind, sdp, candidate } = {}) => {
        if (!socket.data.isAuth) {
            emitCallError(socket, { code: "UNAUTHORIZED", message: "Authorization required", callId, chatId });
            return;
        }
        if (!callId || !chatId) {
            emitCallError(socket, { code: "INVALID_PAYLOAD", message: "callId and chatId are required", callId, chatId });
            return;
        }
        if (!SIGNAL_KINDS.has(kind)) {
            emitCallError(socket, {
                code: "INVALID_SIGNAL_KIND",
                message: "Invalid signal kind",
                callId,
                chatId,
            });
            return;
        }
        if ((kind === "offer" || kind === "answer") && typeof sdp !== "string") {
            emitCallError(socket, {
                code: "MISSING_SIGNAL_DATA",
                message: "SDP payload is required",
                callId,
                chatId,
            });
            return;
        }
        if (kind === "ice-candidate" && (!candidate || typeof candidate !== "object")) {
            emitCallError(socket, {
                code: "MISSING_SIGNAL_DATA",
                message: "candidate payload is required",
                callId,
                chatId,
            });
            return;
        }

        let memberIds = null;
        try {
            memberIds = await getChatMemberIdsDb(chatId, socket.data.userId);
        } catch {
            if (CALL_MEMORY_FALLBACK_ENABLED) {
                memberIds = getChatMemberIdsMemory(chatId, socket.data.userId);
            }
        }

        if (!memberIds) {
            emitCallError(socket, {
                code: "FORBIDDEN_CHAT_ACCESS",
                message: "No access to chat",
                callId,
                chatId,
            });
            return;
        }

        emitToMembers(
            io,
            memberIds.filter((id) => id !== socket.data.userId),
            "call:signal",
            {
                callId,
                chatId,
                kind,
                sdp: typeof sdp === "string" ? sdp : null,
                candidate: candidate ?? null,
                fromUserId: socket.data.userId,
                at: getNowIso(),
            }
        );
    });

    socket.on("call:history:get", async ({ chatId, limit, cursor } = {}) => {
        if (!socket.data.isAuth) {
            emitCallError(socket, { code: "UNAUTHORIZED", message: "Authorization required", chatId });
            return;
        }
        if (!chatId || typeof chatId !== "string") {
            emitCallError(socket, { code: "INVALID_PAYLOAD", message: "chatId is required" });
            return;
        }

        const pageLimit = normalizeLimit(limit);
        const cursorTime = cursor ? new Date(cursor).getTime() : null;

        try {
            const memberIds = await getChatMemberIdsDb(chatId, socket.data.userId);
            if (!memberIds) {
                emitCallError(socket, {
                    code: "FORBIDDEN_CHAT_ACCESS",
                    message: "No access to chat",
                    chatId,
                });
                return;
            }

            const rows = await prisma.callSession.findMany({
                where: {
                    chatId,
                    ...(Number.isFinite(cursorTime)
                        ? {
                            createdAt: {
                                lt: new Date(cursorTime),
                            },
                        }
                        : {}),
                },
                orderBy: {
                    createdAt: "desc",
                },
                take: pageLimit + 1,
            });

            const hasMore = rows.length > pageLimit;
            const page = hasMore ? rows.slice(0, pageLimit) : rows;
            const nextCursor = hasMore ? page[page.length - 1]?.createdAt?.toISOString?.() ?? null : null;

            socket.emit("call:history", {
                chatId,
                items: page.map(serializeCall),
                hasMore,
                nextCursor,
            });
        } catch {
            if (!CALL_MEMORY_FALLBACK_ENABLED) {
                emitCallError(socket, {
                    code: "INTERNAL_ERROR",
                    message: "Call history is temporarily unavailable",
                    chatId,
                });
                return;
            }

            const memberIds = getChatMemberIdsMemory(chatId, socket.data.userId);
            if (!memberIds) {
                emitCallError(socket, {
                    code: "FORBIDDEN_CHAT_ACCESS",
                    message: "No access to chat",
                    chatId,
                });
                return;
            }

            const rows = listCallsByChatId(chatId).filter((row) => {
                if (!Number.isFinite(cursorTime)) return true;
                return new Date(row.createdAt).getTime() < cursorTime;
            });
            const hasMore = rows.length > pageLimit;
            const page = hasMore ? rows.slice(0, pageLimit) : rows;
            const nextCursor = hasMore ? page[page.length - 1]?.createdAt ?? null : null;

            socket.emit("call:history", {
                chatId,
                items: page.map(serializeCall),
                hasMore,
                nextCursor,
            });
        }
    });
}
