export const SUPPORT_CATEGORY_LABELS = {
    question: "Вопрос",
    suggestion: "Предложение",
    technical: "Техническая проблема",
    violation: "Нарушение",
    other: "Другое",
};

export const SUPPORT_STATUS_LABELS = {
    new: "Отправлено",
    in_progress: "На рассмотрении",
    answered: "Получен ответ",
    closed: "Закрыто",
};

export function validSupportDraft({ category, subject, text }) {
    return Object.hasOwn(SUPPORT_CATEGORY_LABELS, category)
        && String(subject ?? "").trim().length >= 3
        && String(text ?? "").trim().length >= 5;
}

export function supportCounters(requests) {
    const counters = { total: requests.length, new: 0, in_progress: 0, answered: 0, closed: 0 };
    requests.forEach((request) => {
        if (Object.hasOwn(counters, request.status)) counters[request.status] += 1;
    });
    return counters;
}

export function filterSupportRequests(requests, query = "", status = "all") {
    const needle = String(query).trim().toLocaleLowerCase("ru-RU");
    return requests.filter((request) => {
        if (status !== "all" && request.status !== status) return false;
        if (!needle) return true;
        return [request.subject, SUPPORT_CATEGORY_LABELS[request.category], request.author?.name, request.author?.phone]
            .some((value) => String(value ?? "").toLocaleLowerCase("ru-RU").includes(needle));
    });
}
