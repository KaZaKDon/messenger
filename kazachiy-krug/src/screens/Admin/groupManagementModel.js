export const GROUP_MODE_LABELS = {
    readonly: "Только публикации",
    announcements: "Объявления",
    chat: "Чат",
};

export const GROUP_CONTENT_LABELS = {
    notice: "Информация",
    advertisement: "Карточки объявлений",
    chat: "Сообщения чата",
};

export const GROUP_VISIBILITY_LABELS = {
    public: "Видят все",
    private: "Только допущенные",
};

export const GROUP_POLICY_LABELS = {
    members: "Все, кто видит группу",
    selected_authors: "Назначенные авторы",
    admin_moderator: "Администратор и модератор",
    owner: "Владелец группы",
    admin: "Только администратор",
};

export const GROUP_STATUS_LABELS = {
    active: "Активна",
    disabled: "Отключена",
    archived: "В архиве",
};

export const GROUP_TEMPLATES = [
    { id: "information", label: "Нужное — администратор и модератор" },
    { id: "selected", label: "Администрация / музеи — выбранные авторы" },
    { id: "advertisement", label: "Категория объявлений — публикуют все" },
    { id: "chat", label: "Открытый чат" },
    { id: "private", label: "Закрытая группа как 010" },
    { id: "paid", label: "Группа владельца по договору" },
    { id: "vip", label: "VIP — только администратор управляет доступом" },
];

export function groupKindLabel(group) {
    if (group.isVip) return "VIP";
    if (group.publishPolicy === "owner") return "Группа владельца";
    if (group.visibility === "private") return "Закрытая группа";
    if (group.publishPolicy === "selected_authors") return "Объявления назначенных авторов";
    if (group.publishPolicy === "admin_moderator") return "Информационная";
    if (group.contentType === "advertisement") return "Категория объявлений";
    return "Открытый чат";
}

export function filterManagedGroups(groups, { query = "", status = "all" } = {}) {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    return groups.filter((group) => {
        if (status === "private" && group.visibility !== "private") return false;
        if (status !== "all" && status !== "private" && group.status !== status) return false;
        if (!normalized) return true;
        return [group.title, group.chatId, groupKindLabel(group)]
            .some((value) => String(value ?? "").toLocaleLowerCase("ru-RU").includes(normalized));
    });
}

export function groupCounters(groups) {
    return {
        total: groups.length,
        active: groups.filter((group) => group.status === "active").length,
        private: groups.filter((group) => group.visibility === "private").length,
        disabled: groups.filter((group) => group.status !== "active").length,
    };
}
