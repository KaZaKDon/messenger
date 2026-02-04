const initialState = {
    byId: {},
    allIds: [],
    loaded: false
};

export function usersReducer(state = initialState, action) {
    switch (action.type) {
        case "USERS_LOADED": {
            const byId = {};
            const allIds = [];

            for (const user of action.payload) {
                byId[user.id] = user;
                allIds.push(user.id);
            }

            return {
                ...state,
                byId,
                allIds,
                loaded: true
            };
        }

        default:
            return state;
    }
}