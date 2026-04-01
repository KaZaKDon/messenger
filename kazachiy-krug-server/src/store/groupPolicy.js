import { usersById } from "./users.js";

const ALL_USERS = Object.keys(usersById);

/**
 * Режимы групп:
 * - readonly: витрина (пишут только canPublish)
 * - announcements: доска объявлений (текст + картинка обязательно)
 * - chat: обычный общий чат
 */
const GROUP_CONFIG = [
    // group-1..3: только выбранные пишут (пока дефолт — user-1)
    { id: "group-1", title: "Нужное", mode: "readonly", canPublish: ["user-1"] },
    { id: "group-2", title: "Администрация", mode: "readonly", canPublish: ["user-1"] },
    { id: "group-3", title: "Музеи", mode: "readonly", canPublish: ["user-1"] },

    // group-4..10: объявления (требуем текст + картинку)
    { id: "group-4", title: "Недвижимость", mode: "announcements", requiresAnnouncementWithImage: true },
    { id: "group-5", title: "Домашние животные", mode: "announcements", requiresAnnouncementWithImage: true },
    { id: "group-6", title: "Сад и Огород", mode: "announcements", requiresAnnouncementWithImage: true },
    { id: "group-7", title: "Сельскохозяйственные животные", mode: "announcements", requiresAnnouncementWithImage: true },
    { id: "group-8", title: "Транспорт", mode: "announcements", requiresAnnouncementWithImage: true },
    { id: "group-9", title: "Строительство Стройматериалы", mode: "announcements", requiresAnnouncementWithImage: true },
    { id: "group-10", title: "Личные вещи", mode: "announcements", requiresAnnouncementWithImage: true },
    { id: "group-11", title: "Услуги", mode: "announcements", requiresAnnouncementWithImage: true },

    // group-11: обычный общий чат
    { id: "group-12", title: "ПОБОЛТАЕМ", mode: "chat" },
    // group-12: закрытая группа "010" (видят только user-1 и user-3)
    { id: "group-13", title: "010", mode: "chat", members: ["user-1", "user-7"], canPublish: ["user-1", "user-7"] },
];

const ANNOUNCEMENT_MODE_ENABLED = true;

function buildGroup(cfg = {}) {
    const id = cfg.id;

    // NEW: если members задан, используем его; иначе все пользователи
    const members =
        Array.isArray(cfg.members) && cfg.members.length > 0
            ? cfg.members
            : ALL_USERS;

    // NEW: по умолчанию писать могут только участники этой группы
    const canPublish =
        Array.isArray(cfg.canPublish) ? cfg.canPublish : members;

    const mode = cfg.mode ?? "chat";

    return {
        id,
        roomId: id,
        title: cfg.title,
        mode,
        members,
        canPublish,
        requiresAnnouncementWithImage:
            cfg.requiresAnnouncementWithImage ?? mode === "announcements",
    };
}

export const GROUP_RULES = GROUP_CONFIG.reduce((acc, cfg) => {
    const group = buildGroup(cfg);
    acc[group.id] = group;
    return acc;
}, {});

export function getGroupRuleByChatId(chatId) {
    return GROUP_RULES[chatId] ?? null;
}

export function canPublishToGroup(chatId, userId) {
    const group = getGroupRuleByChatId(chatId);
    if (!group) return true;
    return group.canPublish.includes(userId);
}

/**
 * Валидация сообщений для групп-объявлений.
 * Сейчас правило: текст + картинка (imageUrl или imageUrls).
 */
export function validateGroupMessage(chatId, message) {
    const group = getGroupRuleByChatId(chatId);

    // не группа — разрешаем
    if (!group) return { ok: true };

    // только для режима announcements (и если включено)
    if (group.mode !== "announcements") return { ok: true };
    if (!group.requiresAnnouncementWithImage) return { ok: true };
    if (!ANNOUNCEMENT_MODE_ENABLED) return { ok: true };

    const hasText =
        typeof message?.text === "string" && message.text.trim().length > 0;

    if (!hasText || !hasImageContent(message)) {
        return {
            ok: false,
            reason: "Для групп 4–10 требуется формат: объявление + картинка (text + image attachment).",
        };
    }

    return { ok: true };
}
