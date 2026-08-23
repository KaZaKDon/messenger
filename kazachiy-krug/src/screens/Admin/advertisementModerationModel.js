export const ADVERTISEMENT_MODERATION_REASONS = {
    needs_edit: [
        "Текст не соответствует фотографиям",
        "Выбрана неправильная группа",
        "Недостаточно информации",
        "Некорректный заголовок",
        "Неверно указан населённый пункт",
        "Фотографии плохого качества или не относятся к объявлению",
        "Объявление дублирует другую публикацию",
        "Другая причина",
    ],
    removed: [
        "Запрещённый товар или услуга",
        "Мошенничество или подозрение на него",
        "Незаконное содержание",
        "Оскорбления или непристойные материалы",
        "Спам",
        "Неоднократное нарушение правил",
        "Другая серьёзная причина",
    ],
};

export function moderationActionLabel(status) {
    return status === "needs_edit" ? "Отправить на исправление" : "Снять окончательно";
}

export function buildModerationReason(reason, comment) {
    const normalizedReason = String(reason ?? "").trim();
    const normalizedComment = String(comment ?? "").trim();
    if (!normalizedReason || !normalizedComment) return "";
    return `${normalizedReason}. ${normalizedComment}`;
}
