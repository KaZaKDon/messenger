import { adminRequest } from "./adminRequest";

export function fetchManagedSettlements() {
    return adminRequest("/admin/settlements");
}

export function createManagedSettlement(name) {
    return adminRequest("/admin/settlements", { method: "POST", body: { name } });
}

export function updateManagedSettlement(id, body) {
    return adminRequest(`/admin/settlements/${encodeURIComponent(id)}`, { method: "PATCH", body });
}
