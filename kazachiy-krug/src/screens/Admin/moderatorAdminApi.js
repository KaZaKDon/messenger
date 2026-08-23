import { adminRequest } from "./adminRequest";

export function fetchModerators() {
    return adminRequest("/admin/moderators");
}

export function assignModerator(userId) {
    return adminRequest(`/admin/moderators/${encodeURIComponent(userId)}`, { method: "PUT" });
}

export function removeModerator(userId) {
    return adminRequest(`/admin/moderators/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

export function blockModerator(userId, reason) {
    return adminRequest(`/moderation/users/${encodeURIComponent(userId)}/block`, {
        method: "POST",
        body: { reason },
    });
}

export function unblockModerator(userId) {
    return adminRequest(`/admin/users/${encodeURIComponent(userId)}/unblock`, { method: "POST" });
}
