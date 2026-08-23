import { adminRequest } from "./adminRequest";

export function fetchManagedComplaints() {
    return adminRequest("/moderation/complaints");
}

export function reviewManagedComplaint(complaintId, body) {
    return adminRequest(`/moderation/complaints/${encodeURIComponent(complaintId)}`, {
        method: "PATCH",
        body,
    });
}
