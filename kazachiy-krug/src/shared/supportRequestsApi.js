import { API_BASE_URL } from "./config";

export const SUPPORT_REQUESTS_UPDATED_EVENT = "kazachiy-krug:support-requests-updated";

async function supportRequest(path, options = {}) {
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
    if (!response.ok) throw new Error(payload?.error ?? "Не удалось выполнить действие с обращением");
    return payload;
}

export function notifySupportRequestsUpdated() {
    window.dispatchEvent(new Event(SUPPORT_REQUESTS_UPDATED_EVENT));
}

export function fetchMySupportRequests() { return supportRequest("/support-requests/mine"); }
export function fetchSupportUnreadCount() { return supportRequest("/support-requests/unread-count"); }
export function createSupportRequest(body) { return supportRequest("/support-requests", { method: "POST", body }); }
export function addSupportMessage(id, text) { return supportRequest(`/support-requests/${encodeURIComponent(id)}/messages`, { method: "POST", body: { text } }); }
export function closeMySupportRequest(id) { return supportRequest(`/support-requests/${encodeURIComponent(id)}/close`, { method: "POST" }); }
export function markSupportRequestRead(id) { return supportRequest(`/support-requests/${encodeURIComponent(id)}/read`, { method: "POST" }); }
