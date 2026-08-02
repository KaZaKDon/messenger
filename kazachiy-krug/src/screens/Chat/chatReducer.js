export const initialState = {
    users: [],
    chats: {},
    activeChatUserId: null,
    activeChatId: null,
};

function ensureChat(state, chatId) {
    if (state.chats[chatId]) return state.chats;

    return {
        ...state.chats,
        [chatId]: {
            id: chatId,
            type: chatId?.startsWith?.("group-") ? "group" : "private",
            title: "",
            canPublish: true,
            members: [],
            membersInfo: [],
            otherUser: null,
            hasMoreHistory: false,
            historyLoading: false,
            historyNotice: "",
            messages: [],
            draft: "",
            typingUsers: [],
        },
    };
}

const MESSAGE_STATUS_RANK = {
    sent: 1,
    delivered: 2,
    read: 3,
};

function resolveMessageStatus(currentStatus, nextStatus) {
    if (!nextStatus) return currentStatus;
    if (!currentStatus) return nextStatus;

    const currentRank = MESSAGE_STATUS_RANK[currentStatus] ?? 0;
    const nextRank = MESSAGE_STATUS_RANK[nextStatus] ?? 0;

    return nextRank >= currentRank ? nextStatus : currentStatus;
}

function hasItems(value) {
    return Array.isArray(value) && value.length > 0;
}

function hasValue(value) {
    return value !== undefined && value !== null;
}

function mergeMessage(existingMessage, nextMessage) {
    const merged = {
        ...existingMessage,
        ...nextMessage,
        status: resolveMessageStatus(existingMessage.status, nextMessage.status),
    };

    if (hasItems(existingMessage.attachments) && !hasItems(nextMessage.attachments)) {
        merged.attachments = existingMessage.attachments;
    }

    if (hasItems(existingMessage.imageUrls) && !hasItems(nextMessage.imageUrls)) {
        merged.imageUrls = existingMessage.imageUrls;
    }

    if (hasValue(existingMessage.imageUrl) && !hasValue(nextMessage.imageUrl)) {
        merged.imageUrl = existingMessage.imageUrl;
    }

    if (hasValue(existingMessage.type) && !hasValue(nextMessage.type)) {
        merged.type = existingMessage.type;
    }

    return merged;
}

function mergeMessages(existingMessages = [], nextMessages = []) {
    const byId = new Map();

    for (const message of existingMessages) {
        if (!message?.id) continue;
        byId.set(message.id, message);
    }

    for (const message of nextMessages) {
        if (!message?.id) continue;
        const existing = byId.get(message.id);
        byId.set(message.id, existing ? mergeMessage(existing, message) : message);
    }

    return [...byId.values()].sort((a, b) => {
        const aTime = new Date(a?.createdAt ?? 0).getTime();
        const bTime = new Date(b?.createdAt ?? 0).getTime();

        if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
            return aTime - bTime;
        }

        return 0;
    });
}

function updateMessageStatus(chat, messageId, status) {
    if (!chat) return chat;

    const messages = chat.messages.map((message) => {
        if (message.id !== messageId) return message;
        const nextStatus = resolveMessageStatus(message.status, status);
        if (message.status === nextStatus) return message;
        return { ...message, status: nextStatus };
    });

    return { ...chat, messages };
}

export function chatReducer(state, action) {
    switch (action.type) {
        // ---------- USERS ----------
        case "SET_USERS":
            return { ...state, users: action.payload };

        // ---------- ACTIVE CHAT ----------
        case "SET_ACTIVE_CHAT_USER": {
            const id = action.payload;

            // ✅ группы: активный чат = group-id сразу
            if (typeof id === "string" && id.startsWith("group-")) {
                const chats = ensureChat(state, id);

                // если пользователь-карточка группы в списке users имеет name — заголовок на UI берём оттуда,
                // поэтому тут title можно не заполнять.

                return {
                    ...state,
                    activeChatUserId: id,
                    activeChatId: id,
                    chats,
                };
            }

            // личка/сброс: activeChatId придет из chat:opened
            // важно сбросить прошлый activeChatId (например, от группы),
            // чтобы не протекала чужая структура в новый выбор.
            return { ...state, activeChatUserId: id, activeChatId: null };

        }

        case "SET_ACTIVE_CHAT": {
            const {
                chatId,
                messages = [],
                type,
                title,
                members,
                membersInfo,
                otherUser,
                canPublish,
                hasMoreHistory,
            } = action.payload || {};

            if (!chatId) return state;

            const chats = ensureChat(state, chatId);
            const mergedMessages = mergeMessages(chats[chatId].messages, messages);

            return {
                ...state,
                activeChatId: chatId,
                chats: {
                    ...chats,
                    [chatId]: {
                        ...chats[chatId],
                        type: type ?? chats[chatId].type ?? "private",
                        title: title ?? chats[chatId].title ?? "",
                        canPublish: canPublish ?? chats[chatId].canPublish ?? true,
                        members: members ?? chats[chatId].members ?? [],
                        membersInfo: membersInfo ?? chats[chatId].membersInfo ?? [],
                        otherUser: otherUser ?? chats[chatId].otherUser ?? null,
                        hasMoreHistory: hasMoreHistory ?? false,
                        historyLoading: false,
                        historyNotice: "",
                        messages: mergedMessages,
                        typingUsers: chats[chatId].typingUsers ?? [],
                    },
                },
            };
        }
        case "CHAT_HISTORY_LOADING": {
            const { chatId, loading } = action.payload || {};
            if (!chatId) return state;

            const chats = ensureChat(state, chatId);
            const chat = chats[chatId];

            return {
                ...state,
                chats: {
                    ...chats,
                    [chatId]: {
                        ...chat,
                        historyLoading: Boolean(loading),
                        historyNotice: loading ? "" : chat.historyNotice,
                    },
                },
            };
        }

        case "PREPEND_CHAT_HISTORY": {
            const { chatId, messages = [], hasMoreHistory = false } = action.payload || {};
            if (!chatId) return state;

            const chats = ensureChat(state, chatId);
            const chat = chats[chatId];
            const existingIds = new Set((chat.messages ?? []).map((m) => m.id));
            const uniqueMessages = messages.filter((m) => m?.id && !existingIds.has(m.id));

            return {
                ...state,
                chats: {
                    ...chats,
                    [chatId]: {
                        ...chat,
                        messages: [...uniqueMessages, ...(chat.messages ?? [])],
                        hasMoreHistory: Boolean(hasMoreHistory),
                        historyLoading: false,
                        historyNotice: hasMoreHistory ? "" : "История чата загружена полностью",
                    },
                },
            };
        }

        case "CHAT_HISTORY_NOTICE": {
            const { chatId, message = "" } = action.payload || {};
            if (!chatId) return state;

            const chats = ensureChat(state, chatId);
            const chat = chats[chatId];

            return {
                ...state,
                chats: {
                    ...chats,
                    [chatId]: {
                        ...chat,
                        historyNotice: message,
                    },
                },
            };
        }

        case "CHAT_HISTORY_ERROR": {
            const { chatId } = action.payload || {};

            if (chatId) {
                const chats = ensureChat(state, chatId);
                const chat = chats[chatId];

                return {
                    ...state,
                    chats: {
                        ...chats,
                        [chatId]: {
                            ...chat,
                            historyLoading: false,
                        },
                    },
                };
            }

            const chats = Object.fromEntries(
                Object.entries(state.chats).map(([id, chat]) => [
                    id,
                    { ...chat, historyLoading: false },
                ])
            );

            return {
                ...state,
                chats,
            };
        }

        // ---------- DRAFT ----------
        case "SET_DRAFT": {
            const { chatId, text } = action.payload;
            const chats = ensureChat(state, chatId);

            return {
                ...state,
                chats: {
                    ...chats,
                    [chatId]: {
                        ...chats[chatId],
                        draft: text,
                    },
                },
            };
        }

        // ---------- MESSAGES ----------
        case "RECEIVE_MESSAGE": {
            const { chatId, message } = action.payload;
            if (!chatId || !message?.id) return state;

            const chats = ensureChat(state, chatId);
            const chat = chats[chatId];

            const existingMessageIndex = chat.messages.findIndex((m) => m.id === message.id);
            const messages = existingMessageIndex === -1
                ? [...chat.messages, message]
                : chat.messages.map((existingMessage, index) =>
                    index === existingMessageIndex
                        ? mergeMessage(existingMessage, message)
                        : existingMessage
                );

            return {
                ...state,
                chats: {
                    ...chats,
                    [chatId]: {
                        ...chat,
                        messages,
                    },
                },
            };
        }

        case "REMOVE_MESSAGE": {
            const { chatId, messageId } = action.payload || {};
            if (!chatId || !messageId) return state;

            const chats = ensureChat(state, chatId);
            const chat = chats[chatId];

            return {
                ...state,
                chats: {
                    ...chats,
                    [chatId]: {
                        ...chat,
                        messages: chat.messages.filter((m) => m.id !== messageId),
                    },
                },
            };
        }


        case "UPDATE_MESSAGE_STATUS": {
            const { chatId, messageId, status } = action.payload;
            if (!chatId || !messageId || !status) return state;

            const chats = ensureChat(state, chatId);
            const chat = chats[chatId];

            return {
                ...state,
                chats: {
                    ...chats,
                    [chatId]: updateMessageStatus(chat, messageId, status),
                },
            };
        }

        case "UPDATE_USER_STATUS": {
            const { userId, isOnline } = action.payload;
            if (!userId) return state;

            return {
                ...state,
                users: state.users.map((user) =>
                    user.id === userId ? { ...user, isOnline: Boolean(isOnline) } : user
                ),
            };
        }

        case "SET_TYPING": {
            const { chatId, userId } = action.payload;
            if (!chatId || !userId) return state;

            const chats = ensureChat(state, chatId);
            const chat = chats[chatId];
            const typingUsers = chat.typingUsers ?? [];

            if (typingUsers.includes(userId)) return state;

            return {
                ...state,
                chats: {
                    ...chats,
                    [chatId]: {
                        ...chat,
                        typingUsers: [...typingUsers, userId],
                    },
                },
            };
        }

        case "CLEAR_TYPING": {
            const { chatId, userId } = action.payload;
            if (!chatId || !userId) return state;

            const chats = ensureChat(state, chatId);
            const chat = chats[chatId];
            const typingUsers = chat.typingUsers ?? [];

            if (!typingUsers.includes(userId)) return state;

            return {
                ...state,
                chats: {
                    ...chats,
                    [chatId]: {
                        ...chat,
                        typingUsers: typingUsers.filter((id) => id !== userId),
                    },
                },
            };
        }

        default:
            return state;
    }
}