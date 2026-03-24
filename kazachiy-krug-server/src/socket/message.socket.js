import {
    prisma
} from "../db/prisma.js";
import {
    chats
} from "../store/chats.js";
import {
    onlineUsers
} from "../store/onlineUsers.js";
import {
    SOCKET_MEMORY_FALLBACK_ENABLED
} from "../config/runtimeFlags.js";

function isGroupId(id) {
    return typeof id === "string" && id.startsWith("group-");
}

function ensureGroupChatExists(chatId) {
    return chats[chatId] ?? null;
}

function deliverToOnlineMembers(io, senderUserId, memberIds, eventName, payload) {
    for (const memberId of memberIds) {
        if (memberId === senderUserId) continue;
        const sid = onlineUsers.get(memberId);
        if (!sid) continue;
        io.to(sid).emit(eventName, payload);
    }
}
async function getChatContextDb(chatId, userId) {
    return prisma.chat.findFirst({
        where: {
            id: chatId,
            members: {
                some: {
                    userId,
                },
            },
        },
        select: {
            id: true,
            type: true,
            members: {
                select: {
                    userId: true,
                },
            },
        },
    });
}

async function getChatMemberIdsDb(chatId, userId) {
    const chat = await prisma.chat.findFirst({
        where: {
            id: chatId,
            members: {
                some: {
                    userId,
                },
            },
        },
        select: {
            members: {
                select: {
                    userId: true,
                },
            },
        },
    });

    return chat?.members?.map((member) => member.userId) ?? null;
}

async function getGroupRuleDb(chatId) {
    return prisma.groupRule.findUnique({
        where: { chatId },
        select: {
            mode: true,
            requiresAnnouncementWithImage: true,
            publishUserIds: true,
        },
    });
}

function canPublishToGroupByRule(rule, userId) {
    if (!rule) return true;

    if (Array.isArray(rule.publishUserIds) && rule.publishUserIds.length > 0) {
        return rule.publishUserIds.includes(userId);
    }


    if (rule.mode === "chat") return true;
    if (rule.mode === "announcements") return true;

    return false;
}

function validateGroupMessageByRule(rule, message) {
    if (!rule) return { ok: true };
    if (rule.mode !== "announcements") return { ok: true };
    if (!rule.requiresAnnouncementWithImage) return { ok: true };

    const hasText = typeof message?.text === "string" && message.text.trim().length > 0;
    const hasSingle = typeof message?.imageUrl === "string" && message.imageUrl.trim().length > 0;
    const hasMany = Array.isArray(message?.imageUrls) && message.imageUrls.filter(Boolean).length > 0;
    const hasImageAttachment = Array.isArray(message?.attachments)
        && message.attachments.some((attachment) => {
            const mediaType = typeof attachment?.mediaType === "string"
                ? attachment.mediaType.trim().toLowerCase()
                : "";
            return mediaType === "image" && typeof attachment?.url === "string" && attachment.url.trim().length > 0;
        });

    if (!hasText || (!hasSingle && !hasMany && !hasImageAttachment)) {
        return {
            ok: false,
            reason: "Для групп 4–10 требуется формат: объявление + картинка (text + image attachment).",
        };
    }

    return { ok: true };
}

const ALLOWED_MESSAGE_TYPES = new Set(["text", "media", "service"]);
const ALLOWED_MEDIA_TYPES = new Set(["image", "audio", "video", "file"]);

function normalizeMessageType(rawType) {
    if (typeof rawType !== "string") return "text";
    const type = rawType.trim().toLowerCase();
    return ALLOWED_MESSAGE_TYPES.has(type) ? type : "text";
}

function normalizeAttachments(rawAttachments) {
    if (!Array.isArray(rawAttachments)) return [];

    return rawAttachments
        .filter((attachment) => attachment && typeof attachment === "object")
        .map((attachment) => {
            const mediaTypeRaw = typeof attachment.mediaType === "string"
                ? attachment.mediaType.trim().toLowerCase()
                : "file";

            return {
                mediaType: ALLOWED_MEDIA_TYPES.has(mediaTypeRaw) ? mediaTypeRaw : "file",
                url: typeof attachment.url === "string" ? attachment.url.trim() : "",
                mimeType: typeof attachment.mimeType === "string" ? attachment.mimeType : null,
                sizeBytes: Number.isFinite(attachment.sizeBytes) ? Math.max(0, Math.trunc(attachment.sizeBytes)) : null,
                durationMs: Number.isFinite(attachment.durationMs) ? Math.max(0, Math.trunc(attachment.durationMs)) : null,
                waveform: attachment.waveform ?? null,
                width: Number.isFinite(attachment.width) ? Math.max(0, Math.trunc(attachment.width)) : null,
                height: Number.isFinite(attachment.height) ? Math.max(0, Math.trunc(attachment.height)) : null,
            };
        })
        .filter((attachment) => attachment.url);
}

function normalizeMessagePayload(message) {
    const attachments = normalizeAttachments(message?.attachments);
    const hasAudioAttachment = attachments.some((attachment) => attachment.mediaType === "audio");

    return {
        text: hasAudioAttachment ? "" : (typeof message?.text === "string" ? message.text : ""),
        type: hasAudioAttachment ? "media" : normalizeMessageType(message?.type),
        imageUrl: typeof message?.imageUrl === "string" ? message.imageUrl : null,
        imageUrls: Array.isArray(message?.imageUrls) ? message.imageUrls : null,
        attachments,
    };
}

function runMessageSendMemory(io, socket, message) {
    const chatId = message?.chatId;
    if (!chatId) return;

    let chat = chats[chatId];
    if (!chat && isGroupId(chatId)) {
        chat = ensureGroupChatExists(chatId);
    }
    if (!chat) {
        console.log("⛔ drop: chat not found in store", chatId);
        return;
    }

    if (!chat.members.includes(socket.data.userId)) {
        console.log("⛔ drop: sender not member", {
            chatId,
            userId: socket.data.userId
        });
        socket.emit("message:error", {
            chatId,
            messageId: message?.id,
            reason: "У вас нет доступа к этой группе.",
        });

        return;
    }

    if (chat.type === "group") {
        // memory fallback: не применяем store-based group policy
    }

    const normalizedMessage = normalizeMessagePayload(message);
    const serverMessage = {
        ...message,
        text: normalizedMessage.text,
        type: normalizedMessage.type,
        imageUrl: normalizedMessage.imageUrl,
        imageUrls: normalizedMessage.imageUrls,
        attachments: normalizedMessage.attachments,
        senderId: socket.data.userId,
        senderName: socket.data.userName,
        status: "sent",
        createdAt: Date.now(),
    };

    chat.messages.push(serverMessage);
    socket.emit("message:new", serverMessage);

    console.log(`📩 [${chatId}] ${socket.data.userName}: ${serverMessage.text ?? ""}`);

    deliverToOnlineMembers(io, socket.data.userId, chat.members, "message:new", serverMessage);
    socket.emit("message:delivered", {
        chatId,
        messageId: serverMessage.id
    });
}

function runMessageReadMemory(io, socket, chatId, messageId) {
    let chat = chats[chatId];
    if (!chat && isGroupId(chatId)) chat = ensureGroupChatExists(chatId);
    if (!chat) return;

    if (!chat.members.includes(socket.data.userId)) return;

    const msg = chat.messages.find((m) => m.id === messageId);
    if (!msg || msg.senderId === socket.data.userId) return;

    msg.status = "read";

    deliverToOnlineMembers(io, socket.data.userId, chat.members, "message:read", {
        chatId,
        messageId
    });
}

export function messageSocket(io, socket) {
    socket.on("message:send", async (message) => {
        if (!socket.data.isAuth) return;

        const chatId = message?.chatId;

        console.log("➡️ message:send", {
            from: socket.data.userId,
            chatId,
            textLen: message?.text?.length ?? 0,
            imageUrl: message?.imageUrl ?? null,
        });

        if (!chatId) return;

        try {
            const chat = await getChatContextDb(chatId, socket.data.userId);
            if (!chat) {
                socket.emit("message:error", {
                    chatId,
                    messageId: message?.id,
                    reason: "У вас нет доступа к этой группе.",
                });
                return;
            }

            if (chat.type === "group") {
                const rule = await getGroupRuleDb(chatId);

                if (!canPublishToGroupByRule(rule, socket.data.userId)) {
                    socket.emit("message:error", {
                        chatId,
                        messageId: message?.id,
                        reason: "У вас нет прав на публикацию в этой группе.",
                    });
                    return;
                }

                const validation = validateGroupMessageByRule(rule, message);
                if (!validation.ok) {
                    socket.emit("message:error", {
                        chatId,
                        messageId: message?.id,
                        reason: validation.reason,
                    });
                    return;
                }
            }
            const normalizedMessage = normalizeMessagePayload(message);
            const created = await prisma.message.create({
                data: {
                    ...(typeof message?.id === "string" && message.id ? {
                        id: message.id
                    } : {}),
                    chatId,
                    senderId: socket.data.userId,
                    text: normalizedMessage.text,
                    type: normalizedMessage.type,
                    imageUrl: normalizedMessage.imageUrl,
                    imageUrls: normalizedMessage.imageUrls,
                    attachments: {
                        create: normalizedMessage.attachments,
                    },
                    status: "sent",
                },
                include: {
                    attachments: true,
                },
            });

            const serverMessage = {
                ...message,
                id: created.id,
                chatId: created.chatId,
                senderId: created.senderId,
                senderName: socket.data.userName,
                text: created.text,
                type: created.type,
                imageUrl: created.imageUrl,
                imageUrls: created.imageUrls,
                attachments: created.attachments,
                status: created.status,
                createdAt: created.createdAt.getTime(),
            };

            if (chats[chatId]) {
                chats[chatId].messages.push(serverMessage);
            }

            socket.emit("message:new", serverMessage);
            console.log(`📩 [${chatId}] ${socket.data.userName}: ${serverMessage.text ?? ""}`);

            const memberIds = chat.members.map((member) => member.userId);
            deliverToOnlineMembers(io, socket.data.userId, memberIds, "message:new", serverMessage);

            socket.emit("message:delivered", {
                chatId,
                messageId: serverMessage.id
            });
        } catch (error) {
            console.error("message:send db failed, fallback to memory:", error?.message ?? error);
            if (!SOCKET_MEMORY_FALLBACK_ENABLED) {
                socket.emit("message:error", {
                    chatId,
                    messageId: message?.id,
                    reason: "Message service is temporarily unavailable.",
                });
                return;
            }

            runMessageSendMemory(io, socket, message);
        }
    });

    socket.on("message:read", async ({
        chatId,
        messageId
    }) => {
        if (!socket.data.isAuth) return;
        if (!chatId || !messageId) return;

        try {
            const chat = await getChatContextDb(chatId, socket.data.userId);
            if (!chat) return;

            const msg = await prisma.message.findUnique({
                where: {
                    id: messageId
                },
                select: {
                    id: true,
                    chatId: true,
                    senderId: true,
                    status: true,
                },
            });

            if (!msg || msg.chatId !== chatId || msg.senderId === socket.data.userId) return;

            await prisma.message.update({
                where: {
                    id: messageId
                },
                data: {
                    status: "read"
                },
            });


            if (chats[chatId]) {
                const memoryMsg = chats[chatId].messages.find((m) => m.id === messageId);
                if (memoryMsg) memoryMsg.status = "read";
            }
            const memberIds = chat.members.map((member) => member.userId);
            deliverToOnlineMembers(io, socket.data.userId, memberIds, "message:read", {
                chatId,
                messageId
            });
        } catch (error) {
            console.error("message:read db failed, fallback to memory:", error?.message ?? error);
            if (!SOCKET_MEMORY_FALLBACK_ENABLED) {
                socket.emit("message:error", {
                    chatId,
                    messageId,
                    reason: "Message read status is temporarily unavailable.",
                });
                return;
            }

            runMessageReadMemory(io, socket, chatId, messageId);
        }
    });

    socket.on("typing:start", async ({
        chatId
    }) => {
        if (!socket.data.isAuth) return;
        if (!chatId) return;


        try {
            const memberIds = await getChatMemberIdsDb(chatId, socket.data.userId);
            if (!memberIds) return;

            for (const memberId of memberIds) {
                if (memberId === socket.data.userId) continue;
                const sid = onlineUsers.get(memberId);
                if (!sid) continue;
                io.to(sid).emit("typing:start", {
                    chatId,
                    userId: socket.data.userId
                });
            }
        } catch (error) {
            console.error("typing:start db failed, fallback to memory:", error?.message ?? error);
            if (!SOCKET_MEMORY_FALLBACK_ENABLED) return;

            let chat = chats[chatId];
            if (!chat && isGroupId(chatId)) chat = ensureGroupChatExists(chatId);
            if (!chat) return;
            if (!chat.members.includes(socket.data.userId)) return;

            for (const memberId of chat.members) {
                if (memberId === socket.data.userId) continue;
                const sid = onlineUsers.get(memberId);
                if (!sid) continue;
                io.to(sid).emit("typing:start", {
                    chatId,
                    userId: socket.data.userId
                });
            }
        }
    });

    socket.on("typing:stop", async ({
        chatId
    }) => {
        if (!socket.data.isAuth) return;
        if (!chatId) return;


        try {
            const memberIds = await getChatMemberIdsDb(chatId, socket.data.userId);
            if (!memberIds) return;

            for (const memberId of memberIds) {
                if (memberId === socket.data.userId) continue;
                const sid = onlineUsers.get(memberId);
                if (!sid) continue;
                io.to(sid).emit("typing:stop", {
                    chatId,
                    userId: socket.data.userId
                });
            }
        } catch (error) {
            console.error("typing:stop db failed, fallback to memory:", error?.message ?? error);


            if (!SOCKET_MEMORY_FALLBACK_ENABLED) return;

            let chat = chats[chatId];
            if (!chat && isGroupId(chatId)) chat = ensureGroupChatExists(chatId);
            if (!chat) return;
            if (!chat.members.includes(socket.data.userId)) return;

            for (const memberId of chat.members) {
                if (memberId === socket.data.userId) continue;
                const sid = onlineUsers.get(memberId);
                if (!sid) continue;
                io.to(sid).emit("typing:stop", {
                    chatId,
                    userId: socket.data.userId
                });
            }

        }
    });
}