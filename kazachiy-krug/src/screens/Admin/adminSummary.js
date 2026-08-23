function countStatuses(items, statuses) {
    return items.filter((item) => statuses.includes(item.status)).length;
}

export function buildAdminSummary({
    role,
    moderationUsers = [],
    adminUsers = null,
    registrations = [],
    passwordRecoveries = [],
    groups = null,
    advertisements = [],
    complaints = [],
    supportRequests = [],
    payments = [],
}) {
    const users = adminUsers?.users ?? moderationUsers;

    return {
        users: adminUsers?.total ?? users.length,
        pendingRegistrations: role === "admin" ? registrations.length : null,
        pendingPasswordRecoveries: role === "admin" ? passwordRecoveries.length : null,
        blockedUsers: countStatuses(users, ["blocked"]),
        groups: groups?.total ?? groups?.groups?.length ?? null,
        advertisements: advertisements.filter((item) => item.status !== "deleted").length,
        complaints: countStatuses(complaints, ["new", "in_review"]),
        supportRequests: countStatuses(supportRequests, ["new", "in_progress"]),
        payments: role === "admin" ? payments.length : null,
        moderators: role === "admin"
            ? users.filter((user) => user.role === "moderator" && user.status === "active").length
            : null,
    };
}
