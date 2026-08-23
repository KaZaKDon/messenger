export function effectivePaymentState(payment, now = new Date()) {
    if (payment.status === "voided") return "voided";
    const start = new Date(payment.periodStartsAt);
    const end = new Date(payment.periodEndsAt);
    if (end < now) return "expired";
    if (start > now) return "upcoming";
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
    return daysLeft <= 7 ? "expiring" : "active";
}

export function paymentCounters(payments, now = new Date()) {
    const counters = { total: payments.length, active: 0, expiring: 0, expired: 0, voided: 0, upcoming: 0 };
    for (const payment of payments) counters[effectivePaymentState(payment, now)] += 1;
    return counters;
}

export function filterPayments(payments, { query = "", state = "all" } = {}, now = new Date()) {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    return payments.filter((payment) => {
        if (state !== "all" && effectivePaymentState(payment, now) !== state) return false;
        if (!normalized) return true;
        return [
            payment.groupRule?.chat?.title,
            payment.chatId,
            payment.owner?.name,
            payment.owner?.phone,
            payment.comment,
        ].filter(Boolean).some((value) => String(value).toLocaleLowerCase("ru-RU").includes(normalized));
    });
}

export function formatRubles(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "—";
    return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(amount);
}

export function validPaymentDraft(draft) {
    const amount = Number(String(draft.amount).replace(",", "."));
    const start = new Date(draft.periodStartsAt);
    const end = new Date(draft.periodEndsAt);
    return Boolean(
        draft.chatId && draft.ownerId && Number.isFinite(amount) && amount > 0
        && draft.paidAt && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > start
    );
}
