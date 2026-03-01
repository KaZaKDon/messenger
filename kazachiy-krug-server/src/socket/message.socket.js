import { prisma } from "../db/prisma.js";
import { chats } from "../store/chats.js";
import { onlineUsers } from "../store/onlineUsers.js";
import {
    canPublishToGroup,
    validateGroupMessage,
    getGroupRuleByChatId,
} from "../store/groupPolicy.js";

function isGroupId(id) {
    return typeof id === "string" && id.startsWith("group-");
}

function ensureGroupChatExists(chatId) {
    if (chats[chatId]) return chats[chatId];

    const rule = getGroupRuleByChatId(chatId);
    if (!rule) return null;

    chats[chatId] = {
        id: chatId,
        type: "group",
        members: rule.members,
        messages: [],
        typingUsers: [],
    };

    console.log("🧩 created group chat in store:", chatId);
    return chats[chatId];
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
        console.log("⛔ drop: sender not member", { chatId, userId: socket.data.userId });
        socket.emit("message:error", {
            chatId,
            messageId: message?.id,
            reason: "У вас нет доступа к этой группе.",
        });

        return;
    }

    if (chat.type === "group") {
        if (!canPublishToGroup(chatId, socket.data.userId)) {
            socket.emit("message:error", {
                chatId,
                messageId: message?.id,
                reason: "У вас нет прав на публикацию в этой группе.",
            });

            return;
        }

        const validation = validateGroupMessage(chatId, message);
        if (!validation.ok) {
            console.log("❌ group validation failed", { chatId, reason: validation.reason });
            socket.emit("message:error", {
                chatId,
                messageId: message?.id,
                reason: validation.reason,
            });

            return;
        }
    }

    const serverMessage = {
        ...message,
        senderId: socket.data.userId,
        senderName: socket.data.userName,
        status: "sent",
        createdAt: Date.now(),
    };

    chat.messages.push(serverMessage);
    socket.emit("message:new", serverMessage);

    console.log(`📩 [${chatId}] ${socket.data.userName}: ${serverMessage.text ?? ""}`);

    deliverToOnlineMembers(io, socket.data.userId, chat.members, "message:new", serverMessage);
    socket.emit("message:delivered", { chatId, messageId: serverMessage.id });
}

function runMessageReadMemory(io, socket, chatId, messageId) {
    let chat = chats[chatId];
    if (!chat && isGroupId(chatId)) chat = ensureGroupChatExists(chatId);
    if (!chat) return;

    if (!chat.members.includes(socket.data.userId)) return;

    const msg = chat.messages.find((m) => m.id === messageId);
    if (!msg || msg.senderId === socket.data.userId) return;

    msg.status = "read";

    deliverToOnlineMembers(io, socket.data.userId, chat.members, "message:read", { chatId, messageId });
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
                if (!canPublishToGroup(chatId, socket.data.userId)) {
                    socket.emit("message:error", {
                        chatId,
                        messageId: message?.id,
                        reason: "У вас нет прав на публикацию в этой группе.",
                    });
                    return;
                }

                const validation = validateGroupMessage(chatId, message);
                if (!validation.ok) {
                    socket.emit("message:error", {
                        chatId,
                        messageId: message?.id,
                        reason: validation.reason,
                    });
                    return;
                }
            }
            const created = await prisma.message.create({
                data: {
                    ...(typeof message?.id === "string" && message.id ? { id: message.id } : {}),
                    chatId,
                    senderId: socket.data.userId,
                    text: typeof message?.text === "string" ? message.text : "",
                    imageUrl: typeof message?.imageUrl === "string" ? message.imageUrl : null,
                    imageUrls: Array.isArray(message?.imageUrls) ? message.imageUrls : null,
                    status: "sent",
                },
            });

            const serverMessage = {
                ...message,
                id: created.id,
                chatId: created.chatId,
                senderId: created.senderId,
                senderName: socket.data.userName,
                text: created.text,
                imageUrl: created.imageUrl,
                imageUrls: created.imageUrls,
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

            socket.emit("message:delivered", { chatId, messageId: serverMessage.id });
        } catch (error) {
            console.error("message:send db failed, fallback to memory:", error?.message ?? error);
            runMessageSendMemory(io, socket, message);
        }
    });

    socket.on("message:read", async ({ chatId, messageId }) => {
        if (!socket.data.isAuth) return;
        if (!chatId || !messageId) return;

        try {
            const chat = await getChatContextDb(chatId, socket.data.userId);
            if (!chat) return;

            const msg = await prisma.message.findUnique({
                where: { id: messageId },
                select: {
                    id: true,
                    chatId: true,
                    senderId: true,
                    status: true,
                },
            });

            if (!msg || msg.chatId !== chatId || msg.senderId === socket.data.userId) return;

            await prisma.message.update({
                where: { id: messageId },
                data: { status: "read" },
            });


            if (chats[chatId]) {
                const memoryMsg = chats[chatId].messages.find((m) => m.id === messageId);
                if (memoryMsg) memoryMsg.status = "read";
            }
            const memberIds = chat.members.map((member) => member.userId);
            deliverToOnlineMembers(io, socket.data.userId, memberIds, "message:read", { chatId, messageId });
        } catch (error) {
            console.error("message:read db failed, fallback to memory:", error?.message ?? error);
            runMessageReadMemory(io, socket, chatId, messageId);

        }
    });

    socket.on("typing:start", ({ chatId }) => {
        if (!socket.data.isAuth) return;

        let chat = chats[chatId];
        if (!chat && isGroupId(chatId)) chat = ensureGroupChatExists(chatId);
        if (!chat) return;

        if (!chat.members.includes(socket.data.userId)) return;

        for (const memberId of chat.members) {
            if (memberId === socket.data.userId) continue;
            const sid = onlineUsers.get(memberId);
            if (!sid) continue;
            io.to(sid).emit("typing:start", { chatId, userId: socket.data.userId });
        }
    });

    socket.on("typing:stop", ({ chatId }) => {
        if (!socket.data.isAuth) return;

        let chat = chats[chatId];
        if (!chat && isGroupId(chatId)) chat = ensureGroupChatExists(chatId);
        if (!chat) return;

        if (!chat.members.includes(socket.data.userId)) return;

        for (const memberId of chat.members) {
            if (memberId === socket.data.userId) continue;
            const sid = onlineUsers.get(memberId);
            if (!sid) continue;
            io.to(sid).emit("typing:stop", { chatId, userId: socket.data.userId });
        }
    });
}