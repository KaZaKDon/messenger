export const ADVERTISEMENT_COMPLAINT_REASONS = [
    "Объявление размещено не в той группе",
    "Текст не соответствует фотографиям",
    "Мошенничество или подозрительное предложение",
    "Запрещённый товар или услуга",
    "Оскорбительное или непристойное содержание",
    "Спам или дубликат",
    "Неверные контактные данные",
    "Другая причина",
];

export function canSubmitComplaint({ reason, details }) {
    return ADVERTISEMENT_COMPLAINT_REASONS.includes(reason)
        && String(details ?? "").trim().length >= 3;
}
