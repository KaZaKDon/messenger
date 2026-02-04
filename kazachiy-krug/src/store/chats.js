const initialState = {
    activeChatId: null,
    items: {}
};

export function chatsReducer(state = initialState, action) {
    switch (action.type) {

        case "OPEN_CHAT": {
            const {
                chatId
            } = action.payload;

            return {
                ...state,
                activeChatId: chatId,
                items: {
                    ...state.items,
                    [chatId]: state.items[chatId] ?? {
                        id: chatId,
                        messages: []
                    }
                }
            };
        }

        default:
            return state;
    }
}