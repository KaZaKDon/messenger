export function advertisementDialogMeta(summary) {
    if (!summary) return null;
    return {
        preview: summary.latestTitle || "Нет объявлений",
        timestamp: summary.latestPublishedAt ?? null,
        unread: Number.isFinite(summary.unread) ? Math.max(0, summary.unread) : 0,
    };
}
