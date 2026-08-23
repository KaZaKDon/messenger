import { adminRequest } from "./adminRequest";

const encode = encodeURIComponent;

export async function fetchManagedGroups() {
    const [payload, candidates] = await Promise.all([
        adminRequest("/moderation/groups"),
        adminRequest("/moderation/group-candidates"),
    ]);
    return {
        groups: Array.isArray(payload?.groups) ? payload.groups : [],
        total: Number.isFinite(payload?.total) ? payload.total : 0,
        candidates: Array.isArray(candidates) ? candidates : [],
    };
}

export async function createGroup(source) {
    return adminRequest("/admin/groups", { method: "POST", body: source });
}

export async function updateGroup(chatId, source) {
    return adminRequest(`/admin/groups/${encode(chatId)}`, { method: "PATCH", body: source });
}

export async function changeGroupStatus(chatId, status, reason) {
    return adminRequest(`/moderation/groups/${encode(chatId)}/status`, {
        method: "PATCH",
        body: { status, reason },
    });
}

export async function setGroupAssignment(chatId, kind, userId, assigned) {
    return adminRequest(`/moderation/groups/${encode(chatId)}/${kind}/${encode(userId)}`, {
        method: assigned ? "PUT" : "DELETE",
    });
}

export async function setPaidGroupOwner(chatId, source) {
    const toIsoIfValid = (value) => {
        const parsed = new Date(value);
        return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : value;
    };
    return adminRequest(`/admin/groups/${encode(chatId)}/owner`, {
        method: "PUT",
        body: {
            ...source,
            ownershipStartsAt: toIsoIfValid(source.ownershipStartsAt),
            ownershipEndsAt: toIsoIfValid(source.ownershipEndsAt),
        },
    });
}

export async function clearPaidGroupOwner(chatId, reason) {
    return adminRequest(`/admin/groups/${encode(chatId)}/owner`, {
        method: "DELETE",
        body: { reason },
    });
}
