import { adminRequest } from "./adminRequest";

export async function fetchPaymentManagementData() {
    const [payments, groupPayload, candidates] = await Promise.all([
        adminRequest("/admin/payments"),
        adminRequest("/moderation/groups"),
        adminRequest("/moderation/group-candidates"),
    ]);
    return {
        payments: Array.isArray(payments) ? payments : [],
        groups: (Array.isArray(groupPayload?.groups) ? groupPayload.groups : [])
            .filter((group) => group.publishPolicy === "owner"),
        users: Array.isArray(candidates) ? candidates : [],
    };
}

function localDateToIso(value, endOfDay = false) {
    if (!value) return value;
    return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`).toISOString();
}

export function recordPayment(draft) {
    return adminRequest("/admin/payments", {
        method: "POST",
        body: {
            ...draft,
            amount: String(draft.amount).replace(",", "."),
            paidAt: new Date(draft.paidAt).toISOString(),
            periodStartsAt: localDateToIso(draft.periodStartsAt),
            periodEndsAt: localDateToIso(draft.periodEndsAt, true),
        },
    });
}

export function voidPayment(paymentId, reason) {
    return adminRequest(`/admin/payments/${encodeURIComponent(paymentId)}/void`, {
        method: "POST",
        body: { reason },
    });
}
