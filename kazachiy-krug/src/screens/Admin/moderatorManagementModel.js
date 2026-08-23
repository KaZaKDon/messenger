export function moderatorCounters(payload) {
    const moderators = Array.isArray(payload?.moderators) ? payload.moderators : [];
    const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
    return {
        total: moderators.length,
        active: moderators.filter((user) => user.status === "active").length,
        blocked: moderators.filter((user) => user.status === "blocked").length,
        candidates: candidates.length,
    };
}

export function filterModeratorUsers(users, query = "") {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    if (!normalized) return users;
    return users.filter((user) => [user.name, user.phone, user.email, user.login]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("ru-RU").includes(normalized)));
}

export function canAssignModerator(user) {
    return Boolean(user && user.role === "user" && user.status === "active");
}

export function canRemoveModerator(user, viewerId) {
    return Boolean(user && user.id !== viewerId && user.role === "moderator" && user.status !== "deleted");
}
