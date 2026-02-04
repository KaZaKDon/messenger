import {
    chats
} from "./chats.js";

export function getOrCreatePrivateChat(userA, userB) {
    const chatId = `room-${[userA, userB].sort().join("-")}`;

    if (!chats[chatId]) {
        chats[chatId] = {
            id: chatId,
            members: [userA, userB],
            messages: [],
        };

        console.log("🆕 chat created:", chatId);
    }

    return chats[chatId];
}