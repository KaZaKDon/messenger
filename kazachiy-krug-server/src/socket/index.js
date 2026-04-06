import { authSocket } from "./auth.socket.js";
import { chatSocket } from "./chat.socket.js";
import { messageSocket } from "./message.socket.js";
import { callSocket } from "./call.socket.js";
import { onlineUsers } from "../store/onlineUsers.js";

export function initSocket(io) {
    io.on("connection", (socket) => {
        console.log("🔌 Socket connected:", socket.id);

        socket.data.isAuth = false;

        authSocket(io, socket);
        chatSocket(io, socket);
        messageSocket(io, socket);
        callSocket(io, socket);

        socket.on("disconnect", () => {
            if (socket.data.userId) {
                onlineUsers.delete(socket.data.userId);
                console.log(`🔴 ${socket.data.userName} disconnected`);
            }
        });
    });
}
