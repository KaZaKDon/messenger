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
import { GROUP_RULES } from "../store/groupPolicy.js";
import { getGroupCapabilities } from "../groups/groupAccessPolicy.js";
import { findGroupRuleForAccess } from "../groups/groupAccessRepository.js";
import { isPrivateContactUnavailable } from "../contacts/userBlockService.js";

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
function socketUser(socket) {
    return socket.data.user ?? {
        id: socket.data.userId,
        role: "user",
    };
}

function isChatMember(chat, userId) {
    return chat?.members?.some((member) => member.userId === userId) ?? false;
}

async function getChatContextDb(chatId) {
    return prisma.chat.findFirst({
        where: {
            id: chatId,
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

async function getAccessibleChatContextDb(chatId, socket) {
    const chat = await getChatContextDb(chatId);
    if (!chat) return null;

    const isMember = isChatMember(chat, socket.data.userId);
    if (chat.type !== "group") {
        return isMember ? { chat, rule: null, capabilities: null } : null;
    }

    const rule = await findGroupRuleForAccess(prisma, chatId);
    const capabilities = getGroupCapabilities({
        rule,
        user: socketUser(socket),
        isMember,
    });

    return capabilities.canView ? { chat, rule, capabilities } : null;
}

function emitToChatPeers(io, socket, chat, eventName, payload) {
    if (chat.type === "group" && socket.broadcast?.to) {
        socket.broadcast.to(chat.id).emit(eventName, payload);
        return;
    }

    const memberIds = chat.members.map((member) => member.userId);
    deliverToOnlineMembers(io, socket.data.userId, memberIds, eventName, payload);
}

function getMemoryChatCapabilities(chat, socket) {
    const isMember = chat.members.includes(socket.data.userId);
    if (chat.type !== "group") {
        return {
            canView: isMember,
            canPublish: isMember,
        };
    }

    return getGroupCapabilities({
        rule: GROUP_RULES[chat.id] ?? null,
        user: socketUser(socket),
        isMember,
    });
}

function getLegacyImageUrls(message) {
    return [
        typeof message?.imageUrl === "string" ? message.imageUrl : null,
        ...(Array.isArray(message?.imageUrls) ? message.imageUrls : []),
    ]
        .filter((url) => typeof url === "string")
        .map((url) => url.trim())
        .filter(Boolean);
}

function getImageAttachmentUrls(message) {
    if (!Array.isArray(message?.attachments)) return [];

    return message.attachments
        .filter((attachment) => {
            const mediaType = typeof attachment?.mediaType === "string"
                ? attachment.mediaType.trim().toLowerCase()
                : "";
            return mediaType === "image";
        })
        .map((attachment) => (typeof attachment?.url === "string" ? attachment.url.trim() : ""))
        .filter(Boolean);
}

function hasImageContent(message) {
    return [...new Set([...getLegacyImageUrls(message), ...getImageAttachmentUrls(message)])].length > 0;
}

function validateGroupMessageByRule(rule, message) {
    if (!rule) return { ok: true };
    if (rule.mode !== "announcements") return { ok: true };
    if (!rule.requiresAnnouncementWithImage) return { ok: true };

    const hasText = typeof message?.text === "string" && message.text.trim().length > 0;
    if (!hasText || !hasImageContent(message)) {
        return {
            ok: false,
            reason: "Для групп 4–10 требуется формат: объявление + картинка (text + image attachment).",
        };

    }

    return { ok: true };
}

const ALLOWED_MESSAGE_TYPES = new Set(["text", "media", "service"]);
const ALLOWED_MEDIA_TYPES = new Set(["image", "audio", "video", "file"]);

function hasAttachmentOfType(attachments, mediaType) {
    return attachments.some((attachment) => attachment.mediaType === mediaType);
}

function collectLegacyImageAttachments(message, attachments) {
    if (hasAttachmentOfType(attachments, "image")) return [];

    return [...new Set(getLegacyImageUrls(message))].map((url) => ({
        mediaType: "image",
        url,
        mimeType: null,
        sizeBytes: null,
        durationMs: null,
        waveform: null,
        width: null,
        height: null,
    }));
}


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
    const normalizedAttachments = normalizeAttachments(message?.attachments);
    const attachments = [
        ...normalizedAttachments,
        ...collectLegacyImageAttachments(message, normalizedAttachments),
    ];
    const hasAudioAttachment = hasAttachmentOfType(attachments, "audio");
    const hasAnyAttachment = attachments.length > 0;

    return {
        text: hasAudioAttachment ? "" : (typeof message?.text === "string" ? message.text : ""),
        type: hasAnyAttachment ? "media" : normalizeMessageType(message?.type),
        imageUrl: hasAnyAttachment ? null : (typeof message?.imageUrl === "string" ? message.imageUrl : null),
        imageUrls: hasAnyAttachment ? null : (Array.isArray(message?.imageUrls) ? message.imageUrls : null),
        attachments,
    };
}


function isUnsupportedMessageMediaSchemaError(error) {
    const message = String(error?.message ?? error ?? "");

    return (
        /Unknown (argument|field) [`']?(type|attachments)[`']?/i.test(message) ||
        /Unknown arg [`']?(type|attachments)[`']?/i.test(message)
    );
}

function getLegacyMediaUrl(normalizedMessage) {
    if (typeof normalizedMessage?.imageUrl === "string" && normalizedMessage.imageUrl.trim()) {
        return normalizedMessage.imageUrl;
    }

    const firstAttachment = normalizedMessage?.attachments?.find((attachment) => {
        return typeof attachment?.url === "string" && attachment.url.trim();
    });
    if (firstAttachment) return firstAttachment.url.trim();

    return null;
}

function getLegacyImageUrlsValue(normalizedMessage) {
    if (Array.isArray(normalizedMessage?.imageUrls) && normalizedMessage.imageUrls.length > 0) {
        return normalizedMessage.imageUrls;
    }

    const imageUrls = normalizedMessage?.attachments
        ?.filter((attachment) => attachment.mediaType === "image" && attachment.url)
        .map((attachment) => attachment.url) ?? [];

    return imageUrls.length > 1 ? imageUrls : null;
}

async function createMessageDb({ chatId, socket, message, normalizedMessage }) {
    const baseData = {
        ...(typeof message?.id === "string" && message.id ? {
            id: message.id
        } : {}),
        chatId,
        senderId: socket.data.userId,
        text: normalizedMessage.text,
        imageUrl: normalizedMessage.imageUrl,
        imageUrls: normalizedMessage.imageUrls,
        status: "sent",
    };

    try {
        const created = await prisma.message.create({
            data: {
                ...baseData,
                type: normalizedMessage.type,
                attachments: {
                    create: normalizedMessage.attachments,
                },
            },
            include: {
                attachments: true,
            },
        });

        return { created, usedLegacySchema: false };
    } catch (error) {
        if (!isUnsupportedMessageMediaSchemaError(error)) throw error;

        const created = await prisma.message.create({
            data: {
                ...baseData,
                imageUrl: getLegacyMediaUrl(normalizedMessage),
                imageUrls: getLegacyImageUrlsValue(normalizedMessage),
            },
        });

        return { created, usedLegacySchema: true };
    }
}

function buildServerMessage({ message, normalizedMessage, created, socket, usedLegacySchema }) {
    return {
        ...message,
        id: created.id,
        chatId: created.chatId,
        senderId: created.senderId,
        senderName: socket.data.userName,
        text: created.text,
        type: created.type ?? normalizedMessage.type,
        imageUrl: created.imageUrl ?? (usedLegacySchema ? getLegacyMediaUrl(normalizedMessage) : null),
        imageUrls: created.imageUrls ?? (usedLegacySchema ? getLegacyImageUrlsValue(normalizedMessage) : null),
        attachments: created.attachments ?? (usedLegacySchema ? normalizedMessage.attachments : []),
        status: created.status,
        createdAt: created.createdAt instanceof Date ? created.createdAt.getTime() : created.createdAt,
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

    const capabilities = getMemoryChatCapabilities(chat, socket);
    if (!capabilities.canView) {
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
        const rule = GROUP_RULES[chatId] ?? null;

        if (!capabilities.canPublish) {
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

    emitToChatPeers(io, socket, chat, "message:new", serverMessage);
    socket.emit("message:delivered", {
        chatId,
        messageId: serverMessage.id
    });
}

function runMessageReadMemory(io, socket, chatId, messageId) {
    let chat = chats[chatId];
    if (!chat && isGroupId(chatId)) chat = ensureGroupChatExists(chatId);
    if (!chat) return;

    if (!getMemoryChatCapabilities(chat, socket).canView) return;

    const msg = chat.messages.find((m) => m.id === messageId);
    if (!msg || msg.senderId === socket.data.userId) return;

    msg.status = "read";

    emitToChatPeers(io, socket, chat, "message:read", {
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
            const accessContext = await getAccessibleChatContextDb(chatId, socket);
            if (!accessContext) {
                socket.emit("message:error", {
                    chatId,
                    messageId: message?.id,
                    reason: "У вас нет доступа к этой группе.",
                });
                return;
            }

            const { chat, rule, capabilities } = accessContext;

            if (chat.type === "private") {
                const otherUserId = chat.members.find((member) => member.userId !== socket.data.userId)?.userId;
                if (await isPrivateContactUnavailable(prisma, socket.data.userId, otherUserId)) {
                    socket.emit("message:error", {
                        chatId,
                        messageId: message?.id,
                        reason: "Пользователь сейчас недоступен",
                    });
                    return;
                }
            }

            if (chat.type === "group") {
                if (!capabilities.canPublish) {
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
            const hasVideo = hasAttachmentOfType(normalizedMessage.attachments, "video");
            if (hasVideo && chat.type === "group" && chatId !== "group-12") {
                socket.emit("message:error", {
                    chatId,
                    messageId: message?.id,
                    reason: "Видео можно отправлять только в личных чатах и группе «Поболтаем».",
                });
                return;
            }
            const { created, usedLegacySchema } = await createMessageDb({
                chatId,
                socket,
                message,
                normalizedMessage,
            });

            const serverMessage = buildServerMessage({
                message,
                normalizedMessage,
                created,
                socket,
                usedLegacySchema,
            });

            if (chats[chatId]) {
                chats[chatId].messages.push(serverMessage);
            }

            socket.emit("message:new", serverMessage);
            console.log(`📩 [${chatId}] ${socket.data.userName}: ${serverMessage.text ?? ""}`);

            emitToChatPeers(io, socket, chat, "message:new", serverMessage);

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
            const accessContext = await getAccessibleChatContextDb(chatId, socket);
            if (!accessContext) return;
            const { chat } = accessContext;

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
            emitToChatPeers(io, socket, chat, "message:read", {
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
            const accessContext = await getAccessibleChatContextDb(chatId, socket);
            if (!accessContext) return;

            emitToChatPeers(io, socket, accessContext.chat, "typing:start", {
                chatId,
                userId: socket.data.userId
            });
        } catch (error) {
            console.error("typing:start db failed, fallback to memory:", error?.message ?? error);
            if (!SOCKET_MEMORY_FALLBACK_ENABLED) return;

            let chat = chats[chatId];
            if (!chat && isGroupId(chatId)) chat = ensureGroupChatExists(chatId);
            if (!chat) return;
            if (!getMemoryChatCapabilities(chat, socket).canView) return;

            emitToChatPeers(io, socket, chat, "typing:start", {
                chatId,
                userId: socket.data.userId
            });
        }
    });

    socket.on("typing:stop", async ({
        chatId
    }) => {
        if (!socket.data.isAuth) return;
        if (!chatId) return;


        try {
            const accessContext = await getAccessibleChatContextDb(chatId, socket);
            if (!accessContext) return;

            emitToChatPeers(io, socket, accessContext.chat, "typing:stop", {
                chatId,
                userId: socket.data.userId
            });
        } catch (error) {
            console.error("typing:stop db failed, fallback to memory:", error?.message ?? error);


            if (!SOCKET_MEMORY_FALLBACK_ENABLED) return;

            let chat = chats[chatId];
            if (!chat && isGroupId(chatId)) chat = ensureGroupChatExists(chatId);
            if (!chat) return;
            if (!getMemoryChatCapabilities(chat, socket).canView) return;

            emitToChatPeers(io, socket, chat, "typing:stop", {
                chatId,
                userId: socket.data.userId
            });

        }
    });
}
