import { API_BASE_URL } from "./config";

async function complaintRequest(path, options = {}) {
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
    if (!response.ok) throw new Error(payload?.error ?? "Не удалось отправить жалобу");
    return payload;
}

export function createAdvertisementComplaint(advertisementId, reason, details) {
    return complaintRequest("/complaints", {
        method: "POST",
        body: { targetType: "advertisement", targetId: advertisementId, reason, details },
    });
}
