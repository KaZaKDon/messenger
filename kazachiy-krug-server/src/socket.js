import { getUserByPhone } from "./store/users.js";
import { chats } from "./store/chats.js";
import { usersById } from "./store/users.js";
import { getOrCreatePrivateChat } from "./store/chatHelpers.js";

// userId → socket.id
const onlineUsers = new Map();

function findPrivateChat(userA, userB) {
    return Object.values(chats).find(chat =>
        chat.members.length === 2 &&
        chat.members.includes(userA) &&
        chat.members.includes(userB)
    );
}

export function initSocket(io) {
    io.on("connection", (socket) => {
        console.log("🔌 Socket connected:", socket.id);

        socket.data.isAuth = false;

        // --------------------
        // АВТОРИЗАЦИЯ
        // --------------------
        socket.on("auth:phone", ({ phone }) => {
            console.log("📞 PHONE FROM CLIENT:", phone);
            console.log("📦 USERS IN STORE:", Object.values(usersById));
            const user = getUserByPhone(phone);

            if (!user) {
                console.log("❌ AUTH ERROR:", phone);
                socket.emit("auth:error", { message: "User not found" });
                return;
            }

            socket.data.isAuth = true;
            socket.data.userId = user.id;
            socket.data.userName = user.name;

            onlineUsers.set(user.id, socket.id);

            console.log(`✅ AUTH: ${user.name} (${user.id})`);

            socket.emit("auth:success", {
                id: user.id,
                name: user.name,
                phone: user.phone,
                avatar: user.avatar
            });
        });

        socket.on("auth:restore", ({ userId, name }) => {
            socket.data.isAuth = true;
            socket.data.userId = userId;
            socket.data.userName = name;

            onlineUsers.set(userId, socket.id);

            console.log(`♻️ AUTH RESTORED: ${name} (${userId})`);
        });

        // --------------------
        // ПОЛУЧЕНИЕ СПИСКА ПОЛЬЗОВАТЕЛЕЙ
        // --------------------
        socket.on("users:get", () => {
            if (!socket.data.isAuth) return;

            const users = Object.values(usersById)
                .filter(u => u.id !== socket.data.userId); // ❗ себя не показываем

            socket.emit("users:list", users);
        });

        socket.on("chat:create", ({ targetUserId }) => {
            const currentUserId = socket.data.userId;

            if (currentUserId === targetUserId) return;

            const existingChat = findPrivateChat(
                currentUserId,
                targetUserId
            );

            if (existingChat) {
                socket.emit("chat:open", existingChat);
                return;
            }

            const chatId = `chat-${Date.now()}`;

            const newChat = {
                id: chatId,
                type: "private",
                members: [currentUserId, targetUserId],
                messages: [],
            };

            chats[chatId] = newChat;

            socket.emit("chat:open", newChat);
        });

        socket.on("chat:open", ({ from, to }) => {
            const chat = getOrCreatePrivateChat(from, to);

            socket.emit("chat:opened", {
                chatId: chat.id,
                members: chat.members,
                messages: chat.messages,
            });
        });

        // --------------------
        // ВХОД В ЧАТ
        // --------------------
        socket.on("join:chat", ({ chatId }) => {
            if (!socket.data.isAuth) {
                // не ошибка — просто игнор
                return;
            }

            const chat = chats[chatId];
            if (!chat) return;

            if (!chat.members.includes(socket.data.userId)) return;
            if (socket.rooms.has(chatId)) return;

            socket.join(chatId);

            console.log(`👥 ${socket.data.userName} joined ${chatId}`);
        });

        // --------------------
        // ОТПРАВКА СООБЩЕНИЯ
        // --------------------
        socket.on("message:send", (message) => {
            if (!socket.data.isAuth) return;

            const chat = chats[message.chatId];
            if (!chat) return;

            const serverMessage = {
                ...message,
                senderId: socket.data.userId,
                senderName: socket.data.userName,
                status: "sent",
                createdAt: Date.now()
            };

            chat.messages.push(serverMessage);

            console.log(`📩 ${socket.data.userName}: ${message.text}`);

            socket.to(message.chatId).emit("message:new", serverMessage);

            socket.emit("message:delivered", {
                chatId: message.chatId,
                messageId: serverMessage.id
            });
        });

        // --------------------
        // ПРОЧИТАНО
        // --------------------
        socket.on("message:read", ({ chatId, messageId }) => {
            if (!socket.data.isAuth) return;

            const chat = chats[chatId];
            if (!chat) return;

            const msg = chat.messages.find(m => m.id === messageId);
            if (!msg) return;

            if (msg.senderId === socket.data.userId) return;

            msg.status = "read";

            socket.to(chatId).emit("message:read", {
                chatId,
                messageId
            });
        });

        socket.on("typing:start", ({ chatId }) => {
            if (!socket.data.isAuth) return;

            socket.to(chatId).emit("typing:start", {
                chatId,
                userId: socket.data.userId
            });
        });

        // --------------------
        // DISCONNECT
        // --------------------
        socket.on("disconnect", () => {
            if (socket.data.userId) {
                onlineUsers.delete(socket.data.userId);
                console.log(`🔴 ${socket.data.userName} disconnected`);
            }
        });
    });
}

