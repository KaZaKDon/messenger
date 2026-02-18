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
    { id: "group-4", title: "Домашние животные", mode: "announcements", requiresAnnouncementWithImage: true },
    { id: "group-5", title: "Сад и Огород", mode: "announcements", requiresAnnouncementWithImage: true },
    { id: "group-6", title: "Сельскохозяйственные животные", mode: "announcements", requiresAnnouncementWithImage: true },
    { id: "group-7", title: "Транспорт", mode: "announcements", requiresAnnouncementWithImage: true },
    { id: "group-8", title: "Строительство Стройматериалы", mode: "announcements", requiresAnnouncementWithImage: true },
    { id: "group-9", title: "Личные вещи", mode: "announcements", requiresAnnouncementWithImage: true },
    { id: "group-10", title: "Услуги", mode: "announcements", requiresAnnouncementWithImage: true },

    // group-11: обычный общий чат
    { id: "group-11", title: "ПОБОЛТАЕМ", mode: "chat" },
];

const ANNOUNCEMENT_MODE_ENABLED = true;

function buildGroup(cfg = {}) {
    const id = cfg.id;

    // по умолчанию писать могут все участники,
    // но для readonly мы ожидаем явный canPublish
    const canPublish =
        Array.isArray(cfg.canPublish) ? cfg.canPublish : ALL_USERS;

    const mode = cfg.mode ?? "chat";

    return {
        id,
        roomId: id,
        title: cfg.title,
        mode,
        members: ALL_USERS,
        canPublish,
        requiresAnnouncementWithImage:
            cfg.requiresAnnouncementWithImage ?? mode === "announcements",
    };
}

export const GROUP_RULES = GROUP_CONFIG.reduce((acc, cfg) => {
    acc[cfg.id] = buildGroup(cfg);
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

    // поддерживаем и старое imageUrl, и новое imageUrls (массив)
    const hasSingle =
        typeof message?.imageUrl === "string" && message.imageUrl.trim().length > 0;
    const hasMany =
        Array.isArray(message?.imageUrls) &&
        message.imageUrls.filter(Boolean).length > 0;

    if (!hasText || (!hasSingle && !hasMany)) {
        return {
            ok: false,
            reason: "Для групп 4–10 требуется формат: объявление + картинка (text + imageUrl).",
        };
    }

    return { ok: true };
}