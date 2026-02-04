import { chats } from "../store/chats.js";

export function messageSocket(io, socket) {
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
}