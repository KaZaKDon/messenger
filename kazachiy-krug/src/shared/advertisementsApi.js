import { API_BASE_URL } from "./config";

async function advertisementRequest(path, options = {}) {
    const token = sessionStorage.getItem("accessToken");
    const response = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method ?? "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.error ?? "Не удалось выполнить операцию с объявлением");
    }
    return payload;
}

export function fetchAdvertisements(chatId) {
    return advertisementRequest(`/advertisements?chatId=${encodeURIComponent(chatId)}`);
}

export function fetchMyAdvertisements() {
    return advertisementRequest("/advertisements?mine=true");
}

export function fetchAdvertisementGroupSummaries() {
    return advertisementRequest("/advertisements/group-summaries");
}

export function markAdvertisementGroupRead(chatId) {
    return advertisementRequest(`/advertisements/groups/${encodeURIComponent(chatId)}/read`, {
        method: "POST",
    });
}

export function createAdvertisement(body) {
    return advertisementRequest("/advertisements", { method: "POST", body });
}

export function editAdvertisement(id, body) {
    return advertisementRequest(`/advertisements/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export function fetchSettlements() {
    return advertisementRequest("/settlements");
}

export function extendAdvertisement(id) {
    return advertisementRequest(`/advertisements/${encodeURIComponent(id)}/extend`, { method: "POST" });
}

export function deleteAdvertisement(id) {
    return advertisementRequest(`/advertisements/${encodeURIComponent(id)}`, { method: "DELETE" });
}
