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
    canPublishToGroup,
    getGroupRuleByChatId
} from "../store/groupPolicy.js";
import {
    usersById
} from "../store/users.js";

function isGroupId(id) {
    return typeof id === "string" && id.startsWith("group-");
}

function isAnnouncementGroup(id) {
    if (!isGroupId(id)) return false;
    return getGroupRuleByChatId(id)?.mode === "announcements";
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
        imageUrl: message.imageUrl,
        imageUrls: message.imageUrls,
        status: message.status,
        createdAt: message.createdAt,
    }));
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
            messages: {
                orderBy: {
                    createdAt: "asc"
                },
                take: 200,
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
            },
        },
    });

    if (!groupChat) return null;

    return {
        chatId: groupChat.id,
        title: groupChat.title,
        type: groupChat.type,
        members: groupChat.members.map((m) => m.userId),
        messages: mapDbMessages(groupChat.messages),
        canPublish: canPublishToGroup(groupChat.id, currentUserId),
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
            messages: {
                orderBy: {
                    createdAt: "asc"
                },
                take: 200,
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
            },
        },
    });

    if (!chat) return null;

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
        messages: mapDbMessages(chat.messages),
    };
}

function openGroupFromMemory(socket, chatId, eventName) {
    const groupRule = getGroupRuleByChatId(chatId);
    if (!groupRule) return false;

    const groupChat = chats[groupRule.roomId];
    if (!groupChat) return true;
    if (!groupChat.members.includes(socket.data.userId)) return true;

    socket.emit(eventName, {
        chatId: groupChat.id,
        title: groupChat.title,
        type: groupChat.type,
        members: groupChat.members,
        messages: groupChat.messages,
        canPublish: canPublishToGroup(groupChat.id, socket.data.userId),
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

            if (isGroupId(targetUserId)) {
                openGroupFromMemory(socket, targetUserId, "chat:opened");
                return;
            }

            openPrivateFromMemory(socket, currentUserId, targetUserId, "chat:opened");
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
        }

        const chat = chats[chatId];
        if (!chat) return;
        if (!chat.members.includes(socket.data.userId) && !isAnnouncementGroup(chatId)) return;
        socket.join(chatId);
        console.log(`👥 ${socket.data.userName} joined ${chatId}`);
    });
}