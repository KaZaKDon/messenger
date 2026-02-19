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

            messages: [],
            draft: "",
            typingUsers: [],
        },
    };
}

function updateMessageStatus(chat, messageId, status) {
    if (!chat) return chat;

    const messages = chat.messages.map((message) => {
        if (message.id !== messageId) return message;
        if (message.status === status) return message;
        return { ...message, status };
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

            // личка: activeChatId придет из chat:opened
            return { ...state, activeChatUserId: id };
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
            } = action.payload || {};

            if (!chatId) return state;

            const chats = ensureChat(state, chatId);

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

                        messages,
                        typingUsers: chats[chatId].typingUsers ?? [],
                    },
                },
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

            // защита от дублей
            if (chat.messages.some((m) => m.id === message.id)) return state;

            return {
                ...state,
                chats: {
                    ...chats,
                    [chatId]: {
                        ...chat,
                        messages: [...chat.messages, message],
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