export const initialState = {
    users: [],

    chats: {
        /*
        chatId: {
            id: chatId,
            messages: [],
            draft: ""
        }
        */
    },

    activeChatUserId: null,
    activeChatId: null
};

function ensureChat(state, chatId) {
    if (state.chats[chatId]) return state.chats;

    return {
        ...state.chats,
        [chatId]: {
            id: chatId,
            messages: [],
            draft: ""
        }
    };
}

export function chatReducer(state, action) {
    switch (action.type) {

        // ---------- USERS ----------
        case "SET_USERS":
            return {
                ...state,
                users: action.payload
            };

        // ---------- ACTIVE CHAT ----------
        case "SET_ACTIVE_CHAT_USER":
            return {
                ...state,
                activeChatUserId: action.payload
            };
        
        case "SET_ACTIVE_CHAT": {
            const { chatId, messages = [] } = action.payload;
            const chats = ensureChat(state, chatId);

            return {
                ...state,
                activeChatId: chatId,
                chats: {
                    ...chats,
                    [chatId]: {
                        ...chats[chatId],
                        messages
                    }
                }
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
                        draft: text
                    }
                }
            };
        }

        // ---------- MESSAGES ----------
        case "RECEIVE_MESSAGE": {
            const { chatId, message } = action.payload;
            if (!chatId || !message?.id) return state;

            const chats = ensureChat(state, chatId);
            const chat = chats[chatId];

            // защита от дублей
            if (chat.messages.some(m => m.id === message.id)) {
                return state;
            }

            return {
                ...state,
                chats: {
                    ...chats,
                    [chatId]: {
                        ...chat,
                        messages: [...chat.messages, message]
                    }
                }
            };
        }

        default:
            return state;
    }
}