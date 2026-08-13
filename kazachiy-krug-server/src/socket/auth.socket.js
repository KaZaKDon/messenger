import { usersById } from "../store/users.js";
import { onlineUsers } from "../store/onlineUsers.js";
import { GROUP_RULES } from "../store/groupPolicy.js";
import { chats } from "../store/chats.js";
import { prisma } from "../db/prisma.js";
import { SOCKET_MEMORY_FALLBACK_ENABLED } from "../config/runtimeFlags.js";
import { findSessionUser } from "../auth/session.js";

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

async function authenticateSocketUser(io, socket, user, extra = {}) {
    socket.data.isAuth = true;
    socket.data.userId = user.id;
    socket.data.userName = user.name;
    socket.data.user = user;

    onlineUsers.set(user.id, socket.id);
    emitPresence(io, user.id, true);

    try {
        await joinUserGroupRoomsDb(socket);
    } catch (error) {
        console.error(
            "joinUserGroupRooms db failed, fallback to memory:",
            error?.message ?? error
        );

        if (SOCKET_MEMORY_FALLBACK_ENABLED) {
            joinUserGroupRoomsMemory(socket);
        }
    }

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
        .filter(
            (group) =>
                group?.members?.includes(currentUserId) ||
                isAnnouncementGroup(group?.id)
        )
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
        .filter((user) => user.id !== currentUserId)
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
                status: "active",
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
 * После успешной авторизации сокет подключается ко всем групповым
 * комнатам, участником которых является пользователь.
 */
async function joinUserGroupRoomsDb(socket) {
    const userId = socket.data.userId;
    if (!userId) return;

    const groups = await prisma.chat.findMany({
        where: {
            type: "group",
            members: {
                some: {
                    userId,
                },
            },
        },
        select: {
            id: true,
        },
    });

    for (const group of groups) {
        if (group?.id && !socket.rooms.has(group.id)) {
            socket.join(group.id);
        }
    }
}

function joinUserGroupRoomsMemory(socket) {
    const userId = socket.data.userId;
    if (!userId) return;

    for (const group of Object.values(GROUP_RULES)) {
        const canJoin =
            group?.members?.includes(userId) ||
            isAnnouncementGroup(group?.id);

        if (!canJoin) continue;

        const roomId = group.roomId ?? group.id;

        if (chats && roomId && chats[roomId]) {
            if (!socket.rooms.has(roomId)) {
                socket.join(roomId);
            }
        } else if (roomId && !socket.rooms.has(roomId)) {
            socket.join(roomId);
        }
    }
}

export function authSocket(io, socket) {
    socket.on("auth:session", async ({ token } = {}) => {
        try {
            const auth = await findSessionUser(token);

            if (!auth) {
                socket.emit("auth:error", {
                    message: "Сессия недействительна",
                });
                return;
            }

            await authenticateSocketUser(io, socket, auth.user, {
                restored: true,
            });
        } catch (error) {
            console.error(
                "auth:session failed:",
                error?.message ?? error
            );

            socket.emit("auth:error", {
                message: "Не удалось проверить сессию",
            });
        }
    });

    const rejectLegacyAuth = () => {
        socket.emit("auth:error", {
            message: "Используйте вход по логину и паролю",
        });
    };

    socket.on("auth:phone", rejectLegacyAuth);
    socket.on("auth:login", rejectLegacyAuth);

    socket.on("auth:restore", () => {
        socket.emit("auth:error", {
            message:
                "Восстановление по userId отключено; требуется сессия",
        });
    });

    socket.on("users:get", async () => {
        if (!socket.data.isAuth) return;

        try {
            const list = await listFromDb(socket.data.userId);
            socket.emit("users:list", list);
        } catch (error) {
            console.error(
                "users:get fallback to memory:",
                error?.message ?? error
            );

            if (!SOCKET_MEMORY_FALLBACK_ENABLED) {
                socket.emit("users:error", {
                    message:
                        "Users list is temporarily unavailable",
                });
                return;
            }

            socket.emit(
                "users:list",
                listFromMemory(socket.data.userId)
            );
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