export const COMPLAINT_STATUS_LABELS = {
    new: "Новая",
    in_review: "На рассмотрении",
    resolved: "Решена",
    rejected: "Отклонена",
};

export function complaintCounters(complaints) {
    const counters = { total: complaints.length, new: 0, in_review: 0, resolved: 0, rejected: 0 };
    complaints.forEach((complaint) => {
        if (Object.hasOwn(counters, complaint.status)) counters[complaint.status] += 1;
    });
    return counters;
}

function normalize(value) {
    return String(value ?? "").trim().toLocaleLowerCase("ru-RU");
}

export function complaintTargetTitle(complaint) {
    return complaint?.targetSnapshot?.title || complaint?.targetId || "Объект жалобы";
}

export function filterManagedComplaints(complaints, { query = "", status = "all" } = {}) {
    const needle = normalize(query);
    return complaints.filter((complaint) => {
        if (status !== "all" && complaint.status !== status) return false;
        if (!needle) return true;
        return [
            complaint.reason,
            complaint.details,
            complaintTargetTitle(complaint),
            complaint.targetSnapshot?.groupTitle,
            complaint.reporter?.name,
            complaint.reporter?.phone,
        ].some((value) => normalize(value).includes(needle));
    });
}
