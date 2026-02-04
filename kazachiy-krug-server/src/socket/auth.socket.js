import { getUserByPhone, usersById } from "../store/users.js";
import { onlineUsers } from "../store/onlineUsers.js";

export function authSocket(io, socket) {
    const handleAuthByPhone = (payload) => {
        const phone = typeof payload === "string" ? payload : payload?.phone;

        if (!phone) {
            socket.emit("auth:error", { message: "Phone is required" });
            return;
        }

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
        socket.data.user = user;

        onlineUsers.set(user.id, socket.id);

        console.log(`✅ AUTH: ${user.name} (${user.id})`);

        socket.emit("auth:success", {
            id: user.id,
            name: user.name,
            phone: user.phone,
            avatar: user.avatar
        });
    };

    socket.on("auth:phone", handleAuthByPhone);
    socket.on("auth:login", handleAuthByPhone);

    socket.on("auth:restore", ({ userId, name }) => {
        socket.data.isAuth = true;
        socket.data.userId = userId;
        socket.data.userName = name;

        onlineUsers.set(userId, socket.id);

        console.log(`♻️ AUTH RESTORED: ${name} (${userId})`);
    });

    socket.on("users:get", () => {
        if (!socket.data.isAuth) return;

        const users = Object.values(usersById)
            .filter(u => u.id !== socket.data.userId);

        socket.emit("users:list", users);
    });
}