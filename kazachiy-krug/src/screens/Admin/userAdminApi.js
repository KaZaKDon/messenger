import { adminRequest } from "./adminRequest";
import { normalizeUserListResponse } from "./userManagementModel";

export async function fetchManagedUsers(role) {
    const payload = await adminRequest(role === "admin" ? "/admin/users" : "/moderation/users");
    return normalizeUserListResponse(role, payload);
}

export async function blockManagedUser(userId, reason) {
    return adminRequest(`/moderation/users/${encodeURIComponent(userId)}/block`, {
        method: "POST",
        body: { reason },
    });
}

export async function unblockManagedUser(userId) {
    return adminRequest(`/admin/users/${encodeURIComponent(userId)}/unblock`, {
        method: "POST",
    });
}

export async function deleteManagedUser(userId, reason) {
    return adminRequest(`/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        body: { reason },
    });
}

