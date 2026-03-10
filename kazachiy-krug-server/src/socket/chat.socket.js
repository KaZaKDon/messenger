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

async function canPublishToGroupDb(chatId, userId) {
    const rule = await getGroupRuleDb(chatId);

    if (!rule) return true;

    if (Array.isArray(rule.publishUserIds) && rule.publishUserIds.length > 0) {
        return rule.publishUserIds.includes(userId);
    }

    if (rule.mode === "chat") return true;
    if (rule.mode === "announcements") return true;

    return false;
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

function mapDbMessages(messages = []) {
    return messages.map((message) => ({
        id: message.id,
        chatId: message.chatId,
        senderId: message.senderId,
        text: message.text,
        type: message.type,
        imageUrl: message.imageUrl,
        imageUrls: message.imageUrls,
        attachments: message.attachments ?? [],
        status: message.status,
        createdAt: message.createdAt instanceof Date ? message.createdAt.getTime() : message.createdAt,
    }));
}

async function getChatMessagesPageDb(chatId, beforeCreatedAt = null, pageSize = HISTORY_PAGE_SIZE) {
    const cursor = normalizeCursor(beforeCreatedAt);

    const messages = await prisma.message.findMany({
        where: {
            chatId,
            ...(cursor ? { createdAt: { lt: cursor } } : {}),
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

async function getGroupChatPayloadDb(chatId, currentUserId) {
    const groupChat = await prisma.chat.findFirst({
        where: {
            id: chatId,
            type: "group",
            members: {
                some: {
                    userId: currentUserId,
                },
            },
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
        },
    });

    if (!groupChat) return null;
    const history = await getChatMessagesPageDb(chatId);

    const canPublish = await canPublishToGroupDb(groupChat.id, currentUserId);

    return {
        chatId: groupChat.id,
        title: groupChat.title,
        type: groupChat.type,
        members: groupChat.members.map((m) => m.userId),
        messages: history.messages,
        hasMoreHistory: history.hasMoreHistory,
        canPublish,
    };
}

async function getPrivateChatPayloadDb(currentUserId, targetUserId) {
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
    const history = await getChatMessagesPageDb(chatId);

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
    };
}

function openGroupFromMemory(socket, chatId, eventName) {
    const groupChat = chats[chatId];
    if (!groupChat) return true;
    if (!groupChat.members.includes(socket.data.userId)) return true;

    socket.emit(eventName, {
        chatId: groupChat.id,
        title: groupChat.title,
        type: groupChat.type,
        members: groupChat.members,
        messages: groupChat.messages,
        canPublish: true,
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
    socket.on("chat:create", async ({
        targetUserId
    }) => {
        if (!socket.data.isAuth) return;
        const currentUserId = socket.data.userId;
        if (!targetUserId || currentUserId === targetUserId) return;
        try {
            if (isGroupId(targetUserId)) {
                const groupPayload = await getGroupChatPayloadDb(targetUserId, currentUserId);
                if (!groupPayload) return;
                socket.emit("chat:open", groupPayload);
                return;
            }

            const privatePayload = await getPrivateChatPayloadDb(currentUserId, targetUserId);
            if (!privatePayload) return;

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
                const groupPayload = await getGroupChatPayloadDb(targetUserId, currentUserId);
                if (!groupPayload) return;
                socket.emit("chat:opened", groupPayload);
                return;
            }

            const privatePayload = await getPrivateChatPayloadDb(currentUserId, targetUserId);
            if (!privatePayload) return;

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
            const chat = await prisma.chat.findFirst({
                where: {
                    id: chatId,
                    OR: [
                        {
                            members: {
                                some: {
                                    userId: socket.data.userId,
                                },
                            },
                        },
                        {
                            groupRule: {
                                is: {
                                    mode: "announcements",
                                },
                            },
                        },
                    ],
                },
                select: { id: true },
            });

            if (!chat) return;

            const history = await getChatMessagesPageDb(chatId, beforeCreatedAt);
            socket.emit("chat:history", {
                chatId,
                messages: history.messages,
                hasMoreHistory: history.hasMoreHistory,
            });
        } catch (error) {
            console.error("chat:history db failed:", error?.message ?? error);

            if (SOCKET_MEMORY_FALLBACK_ENABLED) {
                const chat = chats[chatId];
                if (!chat) return;
                if (!chat.members.includes(socket.data.userId)) return;

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

    socket.on("join:chat", async ({ chatId }) => {
        if (!socket.data.isAuth) return;
        if (!chatId) return;
        if (socket.rooms.has(chatId)) return;

        try {
            const chat = await prisma.chat.findFirst({
                where: {
                    id: chatId,
                    OR: [
                        {
                            members: {
                                some: {
                                    userId: socket.data.userId,
                                },
                            },
                        },
                        {
                            groupRule: {
                                is: {
                                    mode: "announcements",
                                },
                            },
                        },
                    ],
                },
                select: { id: true },
            });

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
        if (!chat) return;
        if (!chat.members.includes(socket.data.userId)) return;
        socket.join(chatId);
        console.log(`👥 ${socket.data.userName} joined ${chatId}`);
    });
}