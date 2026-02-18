import { GROUP_RULES } from "./groupPolicy.js";

const groupChats = Object.values(GROUP_RULES).reduce((acc, group) => {
    acc[group.roomId] = {
        id: group.roomId,
        type: "group",
        title: group.title,
        members: [...group.members],
        messages: [],
    };

    return acc;
}, {});

// chatId → объект чата
export const chats = {
    // ✅ вместо "room-1" используем детерминированный DM id
    "room-user-1-user-2": {
        id: "room-user-1-user-2",
        type: "private",
        members: ["user-1", "user-2"],
        messages: [],
    },

    ...groupChats,
};