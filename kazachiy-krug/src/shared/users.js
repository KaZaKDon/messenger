export const usersById = {
    "user-1": {
        id: "user-1",
        name: "Казак",
        phone: "+79515220669",
        avatar: null,
        isOnline: true
    },
    "user-2": {
        id: "user-2",
        name: "Наташа",
        phone: "+79515260822",
        avatar: null,
        isOnline: true
    }
};

/**
 * Утилиты (чистые, без мутаций)
 */

export function getUserById(userId) {
    return usersById[userId] ?? null;
}

export function getUserName(userId) {
    return usersById[userId]?.name ?? "Наташа";
}