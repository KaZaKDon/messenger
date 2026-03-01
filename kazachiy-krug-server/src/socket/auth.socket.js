import { getUserByPhone, usersById } from "../store/users.js";
import { onlineUsers } from "../store/onlineUsers.js";
import { GROUP_RULES } from "../store/groupPolicy.js";
import { chats } from "../store/chats.js";
import { prisma } from "../db/prisma.js";

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

function isAnnouncementGroup(id) {
    if (!isGroupId(id)) return false;
    return GROUP_RULES[id]?.mode === "announcements";
}

function normalizePhone(phone) {
    return String(phone ?? "").replace(/\D/g, "");
}

async function getUserByPhoneDb(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;

    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            phone: true,
            avatar: true,
        },
    });

    return users.find((user) => normalizePhone(user.phone) === normalized) ?? null;
}

async function getUserByIdDb(userId) {
    if (!userId) return null;

    return prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            phone: true,
            avatar: true,
        },
    });
}

function authenticateSocketUser(io, socket, user, extra = {}) {
    socket.data.isAuth = true;
    socket.data.userId = user.id;
    socket.data.userName = user.name;
    socket.data.user = user;

    onlineUsers.set(user.id, socket.id);
    emitPresence(io, user.id, true);

    joinUserGroupRooms(socket);

    socket.emit("auth:success", {
        id: user.id,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar,
        ...extra,
    });
}

function listFromMemory(currentUserId) {
    const groups = Object.values(GROUP_RULES)
        .filter((group) => group?.members?.includes(currentUserId) || isAnnouncementGroup(group?.id))
        .sort((a, b) => groupNumber(a.id) - groupNumber(b.id))
        .map((group) => ({
            id: group.id,
            name: group.title,
            phone: null,
            avatar: null,
            isOnline: false,
            isGroup: true,
        }));

    const users = Object.values(usersById)
        .filter((u) => u.id !== currentUserId)
        .map((user) => ({
            ...user,
            isOnline: onlineUsers.has(user.id),
        }));

    return [...groups, ...users];
}

async function listFromDb(currentUserId) {
    const [groups, users] = await Promise.all([
        prisma.chat.findMany({
            where: {
                type: "group",
                members: {
                    some: {
                        userId: currentUserId,
                    },
                },
            },
            select: {
                id: true,
                title: true,
            },
        }),
        prisma.user.findMany({
            where: {
                id: {
                    not: currentUserId,
                },
            },
            select: {
                id: true,
                name: true,
                phone: true,
                avatar: true,
            },
        }),
    ]);

    const mappedGroups = groups
        .sort((a, b) => groupNumber(a.id) - groupNumber(b.id))
        .map((group) => ({
            id: group.id,
            name: group.title,
            phone: null,
            avatar: null,
            isOnline: false,
            isGroup: true,
        }));

    const mappedUsers = users.map((user) => ({
        ...user,
        isOnline: onlineUsers.has(user.id),
    }));

    return [...mappedGroups, ...mappedUsers];
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
        const canJoin = group?.members?.includes(userId) || isAnnouncementGroup(group?.id);
        if (!canJoin) continue;

        const roomId = group.roomId ?? group.id;
        if (chats && roomId && chats[roomId]) {
            if (!socket.rooms.has(roomId)) socket.join(roomId);
        } else if (roomId) {
            if (!socket.rooms.has(roomId)) socket.join(roomId);
        }
    }
}

export function authSocket(io, socket) {
    const handleAuthByPhone = async (payload) => {
        const phone = typeof payload === "string" ? payload : payload?.phone;

        if (!phone) {
            socket.emit("auth:error", { message: "Phone is required" });
            return;
        }

        
        let user = null;

        try {
            user = await getUserByPhoneDb(phone);
            if (user) {
                console.log(`✅ AUTH via DB: ${user.name} (${user.id})`);
                authenticateSocketUser(io, socket, user);
                return;
            }
        } catch (error) {
            console.error("auth:phone db failed, fallback to memory:", error?.message ?? error);
        }

        console.log("📞 PHONE FROM CLIENT:", phone);
        console.log("📦 USERS IN STORE:", Object.values(usersById));

        user = getUserByPhone(phone);

        if (!user) {
            console.log("❌ AUTH ERROR:", phone);
            socket.emit("auth:error", { message: "User not found" });
            return;
        }

        console.log(`✅ AUTH via memory fallback: ${user.name} (${user.id})`);
        authenticateSocketUser(io, socket, user);
    };


    socket.on("auth:phone", handleAuthByPhone);
    socket.on("auth:login", handleAuthByPhone);

    socket.on("auth:restore", async ({ userId }) => {
        if (!userId) {
            socket.emit("auth:error", { message: "userId is required" });
            return;
        }

        let user = null;

        try {
            user = await getUserByIdDb(userId);
            if (user) {
                console.log(`♻️ AUTH RESTORED via DB: ${user.name} (${user.id})`);
                authenticateSocketUser(io, socket, user, { restored: true });
                return;
            }
        } catch (error) {
            console.error("auth:restore db failed, fallback to memory:", error?.message ?? error);
        }

        user = usersById[userId];
        if (!user) {
            socket.emit("auth:error", { message: "User not found" });
            return;
        }

        console.log(`♻️ AUTH RESTORED via memory fallback: ${user.name} (${user.id})`);
        authenticateSocketUser(io, socket, user, { restored: true });
    });



    socket.on("users:get", async () => {
        if (!socket.data.isAuth) return;
        try {
            const list = await listFromDb(socket.data.userId);
            socket.emit("users:list", list);
        } catch (error) {
            console.error("users:get fallback to memory:", error?.message ?? error);
            socket.emit("users:list", listFromMemory(socket.data.userId));
        }
    });


    socket.on("disconnect", () => {
        const userId = socket.data.userId;
        if (!userId) return;

        const mappedSocketId = onlineUsers.get(userId);
        if (mappedSocketId === socket.id) {
            onlineUsers.delete(userId);
            emitPresence(io, userId, false);
        }
    });
}