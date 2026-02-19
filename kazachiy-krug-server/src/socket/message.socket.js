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

    // ✅ создаём group chat в store, если его не было
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

export function messageSocket(io, socket) {
    socket.on("message:send", (message) => {
        if (!socket.data.isAuth) return;

        const chatId = message?.chatId;

        // ✅ всегда логируем вход (чтобы не было “пустых логов”)
        console.log("➡️ message:send", {
            from: socket.data.userId,
            chatId,
            textLen: message?.text?.length ?? 0,
            imageUrl: message?.imageUrl ?? null,
        });

        if (!chatId) return;

        // ✅ для групп создаём чат в store при необходимости
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
        // возвращаем отправителю серверную версию сообщения
        socket.emit("message:new", serverMessage);


        console.log(`📩 [${chatId}] ${socket.data.userName}: ${serverMessage.text ?? ""}`);

        // ✅ доставка всем онлайн-участникам (не зависит от join/open)
        for (const memberId of chat.members) {
            if (memberId === socket.data.userId) continue;
            const sid = onlineUsers.get(memberId);
            if (!sid) continue;
            io.to(sid).emit("message:new", serverMessage);
        }

        socket.emit("message:delivered", { chatId, messageId: serverMessage.id });
    });

    socket.on("message:read", ({ chatId, messageId }) => {
        if (!socket.data.isAuth) return;

        let chat = chats[chatId];
        if (!chat && isGroupId(chatId)) chat = ensureGroupChatExists(chatId);
        if (!chat) return;

        if (!chat.members.includes(socket.data.userId)) return;

        const msg = chat.messages.find((m) => m.id === messageId);
        if (!msg || msg.senderId === socket.data.userId) return;

        msg.status = "read";

        for (const memberId of chat.members) {
            if (memberId === socket.data.userId) continue;
            const sid = onlineUsers.get(memberId);
            if (!sid) continue;
            io.to(sid).emit("message:read", { chatId, messageId });
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