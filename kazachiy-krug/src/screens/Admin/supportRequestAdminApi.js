import { adminRequest } from "./adminRequest";

export function fetchManagedSupportRequests() { return adminRequest("/moderation/support-requests"); }
export function startManagedSupportRequest(id) { return adminRequest(`/moderation/support-requests/${encodeURIComponent(id)}/start`, { method: "POST" }); }
export function answerManagedSupportRequest(id, text) { return adminRequest(`/moderation/support-requests/${encodeURIComponent(id)}/answer`, { method: "POST", body: { text } }); }
export function closeManagedSupportRequest(id) { return adminRequest(`/moderation/support-requests/${encodeURIComponent(id)}/close`, { method: "POST" }); }
