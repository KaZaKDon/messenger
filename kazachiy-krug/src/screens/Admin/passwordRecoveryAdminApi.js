import { adminRequest } from "./adminRequest";

export function fetchPasswordRecoveries() {
    return adminRequest("/admin/password-recoveries");
}

export function decidePasswordRecovery(requestId, decision, reason = null) {
    return adminRequest(`/admin/password-recoveries/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        body: { decision, reason },
    });
}
