import { API_BASE_URL } from "./config.js";

async function request(path, options = {}) {
    const token = sessionStorage.getItem("accessToken");
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: { ...(options.headers ?? {}), Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Не удалось изменить чёрный список");
    }
    return response.status === 204 ? null : response.json();
}

export async function fetchBlockedUsers() {
    return (await request("/me/blocks")).users ?? [];
}

export async function blockContact(userId) {
    return (await request(`/me/blocks/${encodeURIComponent(userId)}`, { method: "POST" })).user;
}

export async function unblockContact(userId) {
    return request(`/me/blocks/${encodeURIComponent(userId)}`, { method: "DELETE" });
}
