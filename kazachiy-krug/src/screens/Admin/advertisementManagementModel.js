export const ADVERTISEMENT_STATUS_LABELS = {
    active: "Активно",
    needs_edit: "На исправлении",
    removed: "Снято окончательно",
    expired: "Истекло",
    deleted: "Скрыто окончательно",
};

export function effectiveAdvertisementStatus(advertisement, now = new Date()) {
    if (
        advertisement?.status === "active"
        && advertisement?.expiresAt
        && new Date(advertisement.expiresAt).getTime() <= now.getTime()
    ) return "expired";
    return advertisement?.status;
}

export function advertisementCounters(advertisements, now = new Date()) {
    const counters = {
        total: advertisements.length,
        active: 0,
        needs_edit: 0,
        removed: 0,
        expired: 0,
        deleted: 0,
    };
    advertisements.forEach((advertisement) => {
        const status = effectiveAdvertisementStatus(advertisement, now);
        if (Object.hasOwn(counters, status)) counters[status] += 1;
    });
    return counters;
}

function normalize(value) {
    return String(value ?? "").trim().toLocaleLowerCase("ru-RU");
}

export function advertisementGroupTitle(advertisement) {
    return advertisement?.groupRule?.chat?.title || advertisement?.chatId || "Без группы";
}

export function filterManagedAdvertisements(advertisements, {
    query = "",
    status = "all",
    group = "all",
    now = new Date(),
} = {}) {
    const needle = normalize(query);
    return advertisements.filter((advertisement) => {
        const actualStatus = effectiveAdvertisementStatus(advertisement, now);
        if (status !== "all" && actualStatus !== status) return false;
        if (group !== "all" && advertisement.chatId !== group) return false;
        if (!needle) return true;
        return [
            advertisement.title,
            advertisement.description,
            advertisement.settlement,
            advertisement.author?.name,
            advertisement.author?.phone,
            advertisementGroupTitle(advertisement),
        ].some((value) => normalize(value).includes(needle));
    });
}

export function remainingPublicationLabel(advertisement, now = new Date()) {
    if (!advertisement?.expiresAt) return "Без автоматического срока";
    const difference = new Date(advertisement.expiresAt).getTime() - now.getTime();
    if (difference <= 0) return "Срок истёк";
    const days = Math.ceil(difference / 86_400_000);
    return `${days} дн. до окончания`;
}
