export const USER_STATUS_LABELS = {
    pending: "Ожидает подтверждения",
    active: "Активен",
    rejected: "Отклонён",
    blocked: "Заблокирован",
    deleted: "Удалён",
};

export const USER_ROLE_LABELS = {
    admin: "Администратор",
    moderator: "Модератор",
    user: "Пользователь",
};

const EMPTY_COUNTS = {
    pending: 0,
    active: 0,
    rejected: 0,
    blocked: 0,
    deleted: 0,
};

function countsFromUsers(users) {
    const counts = { ...EMPTY_COUNTS };
    for (const user of users) {
        if (Object.hasOwn(counts, user.status)) counts[user.status] += 1;
    }
    return counts;
}

export function normalizeUserListResponse(role, payload) {
    if (role === "admin") {
        const users = Array.isArray(payload?.users) ? payload.users : [];
        return {
            users,
            counts: { ...EMPTY_COUNTS, ...(payload?.counts ?? {}) },
            total: Number.isFinite(payload?.total) ? payload.total : users.length,
        };
    }

    const users = Array.isArray(payload) ? payload : [];
    return { users, counts: countsFromUsers(users), total: users.length };
}

export function filterManagedUsers(users, { query = "", status = "all" } = {}) {
    const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");

    return users.filter((user) => {
        if (status !== "all" && user.status !== status) return false;
        if (!normalizedQuery) return true;

        return [user.name, user.phone, user.email, user.login]
            .filter(Boolean)
            .some((value) => String(value).toLocaleLowerCase("ru-RU").includes(normalizedQuery));
    });
}

export function getAllowedUserActions({ viewerRole, viewerId, user }) {
    if (!user || user.status === "deleted" || user.role === "admin" || user.id === viewerId) {
        return [];
    }

    if (viewerRole === "moderator") {
        return user.role === "user" && user.status === "active" ? ["block"] : [];
    }

    if (viewerRole !== "admin") return [];

    const actions = [];
    if (user.status === "active") actions.push("block");
    if (user.status === "blocked") actions.push("unblock");
    actions.push("delete");
    return actions;
}

export function formatAdminDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

