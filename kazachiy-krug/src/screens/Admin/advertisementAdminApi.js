import { adminRequest } from "./adminRequest";

export function fetchManagedAdvertisements() {
    return adminRequest("/moderation/advertisements");
}

export function moderateManagedAdvertisement(advertisementId, status, reason = "") {
    return adminRequest(`/moderation/advertisements/${encodeURIComponent(advertisementId)}`, {
        method: "PATCH",
        body: { status, reason },
    });
}
