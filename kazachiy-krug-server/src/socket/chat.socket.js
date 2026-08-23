import {
    prisma
} from "../db/prisma.js";
import {
    chats
} from "../store/chats.js";
import {
    getOrCreatePrivateChat
} from "../store/chatHelpers.js";
import {
    usersById
} from "../store/users.js";
import { SOCKET_MEMORY_FALLBACK_ENABLED } from "../config/runtimeFlags.js";
import { getGroupCapabilities } from "../groups/groupAccessPolicy.js";
import { GROUP_RULE_ACCESS_SELECT } from "../groups/groupAccessRepository.js";
import { isPrivateContactUnavailable } from "../contacts/userBlockService.js";

const HISTORY_PAGE_SIZE = 50;

function toTime(value) {
    if (value == null) return null;

    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (value instanceof Date) {
        const timestamp = value.getTime();
        return Number.isNaN(timestamp) ? null : timestamp;
    }

    if (typeof value === "string" && value.trim()) {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
}


function normalizeCursor(value) {
    if (value == null) return null;

    if (typeof value === "number" && Number.isFinite(value)) {
        return new Date(value);
    }

    if (typeof value === "string" && value.trim()) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) return date;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
    }

    return null;
}

function isGroupId(id) {
    return typeof id === "string" && id.startsWith("group-");
}

function isUnsupportedMessageMediaSchemaError(error) {
    const message = String(error?.message ?? error ?? "");

    return (
        /Unknown (argument|field) [`']?(type|attachments)[`']?/i.test(message) ||
        /Unknown arg [`']?(type|attachments)[`']?/i.test(message)
    );
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

function canViewMemoryChat(chat, socket) {
    if (!chat) return false;
    if (chat.type !== "group") return chat.members.includes(socket.data.userId);

    return getGroupCapabilities({
        rule: GROUP_RULES[chat.id] ?? null,
        user: socketUser(socket),
        isMember: chat.members.includes(socket.data.userId),
    }).canView;
}

async function getAccessibleChatDb(chatId, currentUser) {
    const chat = await prisma.chat.findFirst({
        where: {
            id: chatId,
        },
        select: {
            id: true,
            type: true,
            members: {
                where: {
                    userId: currentUser.id,
                },
                select: {
                    userId: true,
                    clearedAt: true,
                },
            },
            groupRule: {
                select: GROUP_RULE_ACCESS_SELECT,
            },
        },
    });

    if (!chat) return null;
    const isMember = isChatMember(chat, currentUser.id);
    if (chat.type !== "group") return isMember ? chat : null;

    const capabilities = getGroupCapabilities({
        rule: chat.groupRule,
        user: currentUser,
        isMember,
    });

    return capabilities.canView ? chat : null;
}

function buildPrivateChatId(userA, userB) {
    return `room-${[userA, userB].sort().join("-")}`;
}

function mapMembersInfoFromUsers(memberIds) {
    return memberIds
        .map((id) => usersById[id])
        .filter(Boolean)
        .map(({
            id,
            name,
            phone,
            avatar
        }) => ({
            id,
            name,
            phone,
            avatar
        }));
}

const AUDIO_URL_PATTERN = /\.(?:ogg|oga|mp3|wav|m4a|webm)(?:[?#].*)?$/i;
const IMAGE_URL_PATTERN = /\.(?:jpg|jpeg|png|webp|gif)(?:[?#].*)?$/i;

function normalizeLegacyUrls(message = {}) {
    return [
        typeof message.imageUrl === "string" ? message.imageUrl : null,
        ...(Array.isArray(message.imageUrls) ? message.imageUrls : []),
    ]
        .filter((url) => typeof url === "string")
        .map((url) => url.trim())
        .filter(Boolean);
}

function getLegacyAttachmentMediaType(url) {
    if (AUDIO_URL_PATTERN.test(url)) return "audio";
    if (IMAGE_URL_PATTERN.test(url)) return "image";
    return "file";
}

function mapLegacyAttachments(message = {}) {
    return normalizeLegacyUrls(message).map((url, index) => ({
        id: `${message.id ?? "legacy"}-legacy-${index}`,
        mediaType: getLegacyAttachmentMediaType(url),
        url,
        mimeType: null,
        sizeBytes: null,
        durationMs: null,
        waveform: null,
        width: null,
        height: null,
    }));
}

function mapDbMessages(messages = []) {
    return messages.map((message) => {
        const attachments = message.attachments?.length
            ? message.attachments
            : mapLegacyAttachments(message);

        return {
            id: message.id,
            chatId: message.chatId,
            senderId: message.senderId,
            text: message.text,
            type: message.type ?? (attachments.length ? "media" : "text"),
            imageUrl: message.imageUrl,
            imageUrls: message.imageUrls,
            attachments,
            status: message.status,
            createdAt: message.createdAt instanceof Date ? message.createdAt.getTime() : message.createdAt,
        };
    });
}

export async function listPrivateDialogsDb(currentUserId, db = prisma) {
    const blockRows = await db.userBlock.findMany({
        where: { OR: [{ blockerId: currentUserId }, { blockedId: currentUserId }] },
        select: { blockerId: true, blockedId: true },
    });
    const unavailableUserIds = new Set(blockRows.map((row) => (
        row.blockerId === currentUserId ? row.blockedId : row.blockerId
    )));
    const memberships = await db.chatMember.findMany({
        where: {
            userId: currentUserId,
            chat: { type: "private" },
        },
        select: {
            clearedAt: true,
            chat: {
                select: {
                    id: true,
                    type: true,
                    members: {
                        select: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    phone: true,
                                    avatar: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    const dialogs = await Promise.all(memberships.map(async (membership) => {
        const membersInfo = membership.chat.members.map(({ user }) => user);
        const otherUser = membersInfo.find((user) => user.id !== currentUserId) ?? null;
        if (!otherUser || unavailableUserIds.has(otherUser.id)) return null;

        const visibleAfter = membership.clearedAt;
        const lastMessage = await db.message.findFirst({
            where: {
                chatId: membership.chat.id,
                ...(membership.clearedAt ? { createdAt: { gt: membership.clearedAt } } : {}),
            },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                chatId: true,
                senderId: true,
                text: true,
                type: true,
                imageUrl: true,
                imageUrls: true,
                attachments: {
                    select: {
                        id: true,
                        mediaType: true,
                        url: true,
                        mimeType: true,
                        sizeBytes: true,
                        durationMs: true,
                        waveform: true,
                        width: true,
                        height: true,
                    },
                },
                status: true,
                createdAt: true,
            },
        });

        if (!lastMessage) return null;

        const unreadCount = await db.message.count({
            where: {
                chatId: membership.chat.id,
                senderId: { not: currentUserId },
                status: { not: "read" },
                ...(visibleAfter ? { createdAt: { gt: visibleAfter } } : {}),
            },
        });
        return {
            chatId: membership.chat.id,
            type: membership.chat.type,
            members: membersInfo.map((user) => user.id),
            membersInfo,
            otherUser,
            messages: mapDbMessages([lastMessage]),
            unreadCount,
        };
    }));

    return dialogs
        .filter(Boolean)
        .sort((a, b) => (b.messages[0]?.createdAt ?? 0) - (a.messages[0]?.createdAt ?? 0));
}

async function getChatMessagesPageDb(chatId, beforeCreatedAt = null, pageSize = HISTORY_PAGE_SIZE, visibleAfter = null) {
    const cursor = normalizeCursor(beforeCreatedAt);
    const cutoff = normalizeCursor(visibleAfter);

    let messages;

    try {
        messages = await prisma.message.findMany({
            where: {
                chatId,
                ...((cursor || cutoff) ? {
                    createdAt: {
                        ...(cursor ? { lt: cursor } : {}),
                        ...(cutoff ? { gt: cutoff } : {}),
                    },
                } : {}),
            },
            orderBy: {
                createdAt: "desc",
            },
            take: pageSize + 1,
            select: {
                id: true,
                chatId: true,
                senderId: true,
                text: true,
                type: true,
                imageUrl: true,
                imageUrls: true,
                attachments: {
                    select: {
                        id: true,
                        mediaType: true,
                        url: true,
                        mimeType: true,
                        sizeBytes: true,
                        durationMs: true,
                        waveform: true,
                        width: true,
                        height: true,
                    },
                },

                status: true,
                createdAt: true,
            },
        });
    } catch (error) {
        if (!isUnsupportedMessageMediaSchemaError(error)) throw error;
        
        messages = await prisma.message.findMany({
            where: {
                chatId,
                ...((cursor || cutoff) ? {
                    createdAt: {
                        ...(cursor ? { lt: cursor } : {}),
                        ...(cutoff ? { gt: cutoff } : {}),
                    },
                } : {}),
            },
            orderBy: {
                createdAt: "desc",
            },
            take: pageSize + 1,
            select: {
                id: true,
                chatId: true,
                senderId: true,
                text: true,
                imageUrl: true,
                imageUrls: true,
                status: true,
                createdAt: true,
            },
        });
    }

    const hasMoreHistory = messages.length > pageSize;
    const page = hasMoreHistory ? messages.slice(0, pageSize) : messages;

    return {
        messages: mapDbMessages(page.reverse()),
        hasMoreHistory,
    };
}

function getChatMessagesPageMemory(chatId, beforeCreatedAt = null, pageSize = HISTORY_PAGE_SIZE) {
    const chat = chats[chatId];
    if (!chat) return { messages: [], hasMoreHistory: false };

    const cursor = toTime(beforeCreatedAt);
    const sorted = [...(chat.messages ?? [])].sort(
        (a, b) => (toTime(a?.createdAt) ?? 0) - (toTime(b?.createdAt) ?? 0)
    );

    const filtered = cursor == null
        ? sorted
        : sorted.filter((message) => {
            const messageTime = toTime(message?.createdAt);
            return messageTime != null && messageTime < cursor;
        });

    const start = Math.max(filtered.length - pageSize, 0);
    const page = filtered.slice(start);

    return {
        messages: page,
        hasMoreHistory: start > 0,
    };
}

async function upsertPrivateChatDb(currentUserId, targetUserId) {
    const chatId = buildPrivateChatId(currentUserId, targetUserId);

    await prisma.chat.upsert({
        where: {
            id: chatId
        },
        update: {
            type: "private",
            title: null
        },
        create: {
            id: chatId,
            type: "private",
            title: null
        },
    });

    await prisma.chatMember.upsert({
        where: {
            chatId_userId: {
                chatId,
                userId: currentUserId
            }
        },
        update: {},
        create: {
            chatId,
            userId: currentUserId,
            role: "member"
        },
    });

    await prisma.chatMember.upsert({
        where: {
            chatId_userId: {
                chatId,
                userId: targetUserId
            }
        },
        update: {},
        create: {
            chatId,
            userId: targetUserId,
            role: "member"
        },
    });

    return chatId;
}

async function getGroupChatPayloadDb(chatId, currentUser) {
    const groupChat = await prisma.chat.findFirst({
        where: {
            id: chatId,
            type: "group",
        },
        select: {
            id: true,
            type: true,
            title: true,
            members: {
                select: {
                    userId: true,
                },
            },
            groupRule: {
                select: GROUP_RULE_ACCESS_SELECT,
            },
        },
    });

    if (!groupChat) return null;
    const capabilities = getGroupCapabilities({
        rule: groupChat.groupRule,
        user: currentUser,
        isMember: isChatMember(groupChat, currentUser.id),
    });
    if (!capabilities.canView) return null;

    const history = await getChatMessagesPageDb(chatId);

    return {
        chatId: groupChat.id,
        title: groupChat.title,
        type: groupChat.type,
        members: groupChat.members.map((m) => m.userId),
        messages: history.messages,
        hasMoreHistory: history.hasMoreHistory,
        canPublish: capabilities.canPublish,
        canModerate: capabilities.canModerate,
        canManageMembers: capabilities.canManageMembers,
        visibility: groupChat.groupRule?.visibility ?? null,
        status: groupChat.groupRule?.status ?? null,
        contentType: groupChat.groupRule?.contentType ?? null,
        requiresAnnouncementWithImage: groupChat.groupRule?.requiresAnnouncementWithImage ?? false,
        advertisementLifetimeDays: groupChat.groupRule?.advertisementLifetimeDays ?? null,
    };
}

async function getPrivateChatPayloadDb(currentUserId, targetUserId) {
    if (await isPrivateContactUnavailable(prisma, currentUserId, targetUserId)) return null;
    const chatId = await upsertPrivateChatDb(currentUserId, targetUserId);

    const chat = await prisma.chat.findUnique({
        where: {
            id: chatId
        },
        select: {
            id: true,
            type: true,
            members: {
                select: {
                    userId: true,
                    clearedAt: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            phone: true,
                            avatar: true,
                        },
                    },
                },
            },
        },
    });

    if (!chat) return null;
    const currentMembership = chat.members.find((member) => member.userId === currentUserId);
    await prisma.message.updateMany({
        where: {
            chatId,
            senderId: { not: currentUserId },
            status: { not: "read" },
            ...(currentMembership?.clearedAt ? { createdAt: { gt: currentMembership.clearedAt } } : {}),
        },
        data: { status: "read" },
    });
    const history = await getChatMessagesPageDb(chatId, null, HISTORY_PAGE_SIZE, currentMembership?.clearedAt);

    const membersInfo = chat.members.map(({
        user
    }) => user);
    const members = membersInfo.map((user) => user.id);
    const otherUser = membersInfo.find((user) => user.id !== currentUserId) ?? null;

    return {
        chatId: chat.id,
        type: chat.type,
        members,
        membersInfo,
        otherUser,
        messages: history.messages,
        hasMoreHistory: history.hasMoreHistory,
        unreadCount: 0,
    };
}

function openGroupFromMemory(socket, chatId, eventName) {
    const groupChat = chats[chatId];
    if (!groupChat) return true;
    const rule = GROUP_RULES[chatId] ?? null;
    const capabilities = getGroupCapabilities({
        rule,
        user: socketUser(socket),
        isMember: groupChat.members.includes(socket.data.userId),
    });
    if (!capabilities.canView) return true;

    socket.emit(eventName, {
        chatId: groupChat.id,
        title: groupChat.title,
        type: groupChat.type,
        members: groupChat.members,
        messages: groupChat.messages,
        canPublish: capabilities.canPublish,
        canModerate: capabilities.canModerate,
        canManageMembers: capabilities.canManageMembers,
        visibility: rule?.visibility ?? null,
        status: rule?.status ?? null,
        contentType: rule?.contentType ?? null,
        requiresAnnouncementWithImage: rule?.requiresAnnouncementWithImage ?? false,
        advertisementLifetimeDays: rule?.advertisementLifetimeDays ?? null,
    });

    return true;
}

function openPrivateFromMemory(socket, currentUserId, targetUserId, eventName) {
    const chat = getOrCreatePrivateChat(currentUserId, targetUserId);

    const membersInfo = mapMembersInfoFromUsers(chat.members);
    const otherId = chat.members.find((id) => id !== currentUserId);
    const otherUser = otherId ? usersById[otherId] : null;

    socket.emit(eventName, {
        chatId: chat.id,
        type: "private",
        members: chat.members,
        membersInfo,
        otherUser: otherUser ?
            {
                id: otherUser.id,
                name: otherUser.name,
                phone: otherUser.phone,
                avatar: otherUser.avatar
            } :
            null,
        messages: chat.messages,
    });
}


export function chatSocket(io, socket) {
    socket.on("chats:get", async () => {
        if (!socket.data.isAuth) return;

        try {
            const dialogs = await listPrivateDialogsDb(socket.data.userId);
            socket.emit("chats:list", dialogs);
        } catch (error) {
            console.error("chats:get db failed:", error?.message ?? error);
            socket.emit("chat:error", { message: "Не удалось загрузить список личных чатов" });
        }
    });

    socket.on("chat:create", async ({
        targetUserId
    }) => {
        if (!socket.data.isAuth) return;
        const currentUserId = socket.data.userId;
        if (!targetUserId || currentUserId === targetUserId) return;
        try {
            if (isGroupId(targetUserId)) {
                const groupPayload = await getGroupChatPayloadDb(targetUserId, socketUser(socket));
                if (!groupPayload) return;
                socket.emit("chat:open", groupPayload);
                return;
            }

            const privatePayload = await getPrivateChatPayloadDb(currentUserId, targetUserId);
            if (!privatePayload) {
                socket.emit("chat:error", { message: "Пользователь сейчас недоступен" });
                return;
            }

            socket.emit("chat:open", privatePayload);
        } catch (error) {
            console.error("chat:create db failed, fallback to memory:", error?.message ?? error);
            if (!SOCKET_MEMORY_FALLBACK_ENABLED) {
                socket.emit("chat:error", { message: "Chat service is temporarily unavailable" });
                return;
            }

            if (isGroupId(targetUserId)) {
                openGroupFromMemory(socket, targetUserId, "chat:open");
                return;
            }

            openPrivateFromMemory(socket, currentUserId, targetUserId, "chat:open");
        }
    });

    socket.on("chat:open", async ({
        to
    }) => {
        if (!socket.data.isAuth) return;

        const currentUserId = socket.data.userId;
        const targetUserId = to;
        if (!targetUserId || currentUserId === targetUserId) return;
        try {
            if (isGroupId(targetUserId)) {
                const groupPayload = await getGroupChatPayloadDb(targetUserId, socketUser(socket));
                if (!groupPayload) return;
                socket.emit("chat:opened", groupPayload);
                return;
            }

            const privatePayload = await getPrivateChatPayloadDb(currentUserId, targetUserId);
            if (!privatePayload) {
                socket.emit("chat:error", { message: "Пользователь сейчас недоступен" });
                return;
            }

            socket.emit("chat:opened", privatePayload);
        } catch (error) {
            console.error("chat:open db failed, fallback to memory:", error?.message ?? error);
            if (!SOCKET_MEMORY_FALLBACK_ENABLED) {
                socket.emit("chat:error", { message: "Chat service is temporarily unavailable" });
                return;
            }


            if (isGroupId(targetUserId)) {
                openGroupFromMemory(socket, targetUserId, "chat:opened");
                return;
            }

            openPrivateFromMemory(socket, currentUserId, targetUserId, "chat:opened");
        }
    });

    socket.on("chat:history", async ({ chatId, beforeCreatedAt }) => {
        if (!socket.data.isAuth) return;
        if (!chatId) return;

        try {
            const chat = await getAccessibleChatDb(chatId, socketUser(socket));

            if (!chat) return;

            const currentMembership = chat.members?.find((member) => member.userId === socket.data.userId);
            const history = await getChatMessagesPageDb(
                chatId,
                beforeCreatedAt,
                HISTORY_PAGE_SIZE,
                chat.type === "private" ? currentMembership?.clearedAt : null
            );
            socket.emit("chat:history", {
                chatId,
                messages: history.messages,
                hasMoreHistory: history.hasMoreHistory,
            });
        } catch (error) {
            console.error("chat:history db failed:", error?.message ?? error);

            if (SOCKET_MEMORY_FALLBACK_ENABLED) {
                const chat = chats[chatId];
                if (!canViewMemoryChat(chat, socket)) return;

                const history = getChatMessagesPageMemory(chatId, beforeCreatedAt);
                socket.emit("chat:history", {
                    chatId,
                    messages: history.messages,
                    hasMoreHistory: history.hasMoreHistory,
                });
                return;
            }

            socket.emit("chat:error", { message: "Chat history is temporarily unavailable" });
        }
    });

    socket.on("chat:delete", async ({ chatId } = {}) => {
        if (!socket.data.isAuth || !chatId) return;

        try {
            const chat = await prisma.chat.findFirst({
                where: {
                    id: chatId,
                    type: "private",
                    members: { some: { userId: socket.data.userId } },
                },
                select: { id: true },
            });
            if (!chat) {
                socket.emit("chat:error", { message: "Удалять можно только свой личный чат" });
                return;
            }

            const clearedAt = new Date();
            await prisma.chatMember.update({
                where: { chatId_userId: { chatId, userId: socket.data.userId } },
                data: { clearedAt },
            });
            socket.leave(chatId);
            socket.emit("chat:deleted", { chatId, clearedAt: clearedAt.toISOString() });
        } catch (error) {
            console.error("chat:delete db failed:", error?.message ?? error);
            socket.emit("chat:error", { message: "Не удалось удалить чат" });
        }
    });

    socket.on("join:chat", async ({ chatId }) => {
        if (!socket.data.isAuth) return;
        if (!chatId) return;
        if (socket.rooms.has(chatId)) return;

        try {
            const chat = await getAccessibleChatDb(chatId, socketUser(socket));

            if (!chat) return;

            socket.join(chatId);
            console.log(`👥 ${socket.data.userName} joined ${chatId}`);
            return;
        } catch (error) {
            console.error("join:chat db failed, fallback to memory:", error?.message ?? error);
            if (!SOCKET_MEMORY_FALLBACK_ENABLED) {
                socket.emit("chat:error", { message: "Chat service is temporarily unavailable" });
                return;
            }

        }

        const chat = chats[chatId];
        if (!canViewMemoryChat(chat, socket)) return;
        socket.join(chatId);
        console.log(`👥 ${socket.data.userName} joined ${chatId}`);
    });
}
