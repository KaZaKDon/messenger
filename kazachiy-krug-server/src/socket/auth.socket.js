import { getUserByPhone, usersById } from "../store/users.js";
import { onlineUsers } from "../store/onlineUsers.js";
import { GROUP_RULES } from "../store/groupPolicy.js";
import { chats } from "../store/chats.js";

function emitPresence(io, userId, isOnline) {
    io.emit("user:online", { userId, isOnline });
}

function isGroupId(id) {
    return typeof id === "string" && id.startsWith("group-");
}

function groupNumber(id) {
    const n = Number(String(id).split("-")[1]);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/**
 * ✅ ВАЖНО: чтобы “круги-объявления” видели все участники онлайн,
 * мы автоматически подписываем сокет на комнаты всех групп, где он участник.
 * Тогда socket.to(chatId).emit(...) будет доставляться всем онлайн-участникам,
 * даже если круг не открыт на фронте.
 */
function joinUserGroupRooms(socket) {
    const userId = socket.data.userId;
    if (!userId) return;

    for (const group of Object.values(GROUP_RULES)) {
        if (!group?.members?.includes(userId)) continue;

        const roomId = group.roomId ?? group.id; // у тебя roomId = group-*
        // безопасность: комната должна существовать как чат в сторе
        if (chats && roomId && chats[roomId]) {
            if (!socket.rooms.has(roomId)) socket.join(roomId);
        } else if (roomId) {
            // даже если чата нет в сторе, join не навредит — но лучше держать консистентность
            if (!socket.rooms.has(roomId)) socket.join(roomId);
        }
    }
}

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
        emitPresence(io, user.id, true);

        // ✅ Автоподписка на комнаты групп (кругов)
        joinUserGroupRooms(socket);

        socket.emit("auth:success", {
            id: user.id,
            name: user.name,
            phone: user.phone,
            avatar: user.avatar,
        });
    };

    socket.on("auth:phone", handleAuthByPhone);
    socket.on("auth:login", handleAuthByPhone);

    socket.on("auth:restore", ({ userId }) => {
        if (!userId) {
            socket.emit("auth:error", { message: "userId is required" });
            return;
        }

        // ✅ не верим name с клиента — берём пользователя на сервере
        const user = usersById[userId];
        if (!user) {
            socket.emit("auth:error", { message: "User not found" });
            return;
        }

        socket.data.isAuth = true;
        socket.data.userId = user.id;
        socket.data.userName = user.name;
        socket.data.user = user;

        onlineUsers.set(user.id, socket.id);

        console.log(`♻️ AUTH RESTORED: ${user.name} (${user.id})`);
        emitPresence(io, user.id, true);

        // ✅ Автоподписка на комнаты групп (кругов)
        joinUserGroupRooms(socket);

        // (опционально) можно подтверждать restore тем же событием, что и логин
        socket.emit("auth:success", {
            id: user.id,
            name: user.name,
            phone: user.phone,
            avatar: user.avatar,
            restored: true,
        });
    });

    socket.on("users:get", () => {
        if (!socket.data.isAuth) return;

        // --- ГРУППЫ: строго по group-1..group-N, сверху списка ---
        const groups = Object.values(GROUP_RULES)
            .filter((group) => group?.members?.includes(socket.data.userId))
            .sort((a, b) => groupNumber(a.id) - groupNumber(b.id))
            .map((group) => ({
                id: group.id,
                name: group.title, // фронт рендерит name
                phone: null,
                avatar: null,
                isOnline: false,
                isGroup: true, // фронт может игнорировать, но полезно иметь
            }));

        // --- ПОЛЬЗОВАТЕЛИ ---
        const users = Object.values(usersById)
            .filter((u) => u.id !== socket.data.userId)
            .map((user) => ({
                ...user,
                isOnline: onlineUsers.has(user.id),
            }));

        // ✅ Сначала круги, потом люди
        socket.emit("users:list", [...groups, ...users]);
    });

    socket.on("disconnect", () => {
        const userId = socket.data.userId;
        if (!userId) return;

        // только если этот socket был актуальным для userId
        const mappedSocketId = onlineUsers.get(userId);
        if (mappedSocketId === socket.id) {
            onlineUsers.delete(userId);
            emitPresence(io, userId, false);
        }
    });
}