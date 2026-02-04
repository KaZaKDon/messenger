import { chats } from "../store/chats.js";
import { getOrCreatePrivateChat } from "../store/chatHelpers.js";

function findPrivateChat(userA, userB) {
    return Object.values(chats).find(chat =>
        chat.members.length === 2 &&
        chat.members.includes(userA) &&
        chat.members.includes(userB)
    );
}

export function chatSocket(io, socket) {
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

    socket.on("join:chat", ({ chatId }) => {
        if (!socket.data.isAuth) {
            return;
        }

        const chat = chats[chatId];
        if (!chat) return;

        if (!chat.members.includes(socket.data.userId)) return;
        if (socket.rooms.has(chatId)) return;

        socket.join(chatId);

        console.log(`👥 ${socket.data.userName} joined ${chatId}`);
    });
}