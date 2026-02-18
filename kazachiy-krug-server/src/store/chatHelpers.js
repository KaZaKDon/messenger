import { chats } from "./chats.js";

/**
 * ✅ Единый стандарт DM:
 * room-${sorted(userA,userB)}
 * type: "private"
 */
export function getOrCreatePrivateChat(userA, userB) {
    const chatId = `room-${[userA, userB].sort().join("-")}`;

    if (!chats[chatId]) {
        chats[chatId] = {
            id: chatId,
            type: "private",
            members: [userA, userB],
            messages: [],
        };

        console.log("🆕 private chat created:", chatId);
    }

    return chats[chatId];
}