export const PURPOSE_LABELS = Object.freeze({
    community: "Общение в сообществе",
    information: "Получение информации",
    find_offers: "Поиск объявлений и предложений",
    publish_announcements: "Публикация объявлений",
    represent_organization: "Представление организации",
    other: "Другая цель",
});

export function formatRegistrationDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Не указано";
    return date.toLocaleString("ru-RU");
}

export function purposeLabel(value) {
    return PURPOSE_LABELS[value] ?? value;
}
