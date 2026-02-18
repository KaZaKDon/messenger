import { onlineUsers } from "../store/onlineUsers.js";

export function presenceSocket(io, socket) {
    socket.on("disconnect", () => {
        if (!socket.data.userId) return;

        onlineUsers.delete(socket.data.userId);
        io.emit("user:online", {
            userId: socket.data.userId,
            isOnline: false,
        });
    });
}
