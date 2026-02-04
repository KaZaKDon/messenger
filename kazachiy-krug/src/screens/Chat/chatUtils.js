export function getLastMessage(chat) {
    if (!chat.messages.length) return null;
    return chat.messages[chat.messages.length - 1];
}

export function getMessageStatusIcon(message) {
    if (!message || !message.fromMe) return null;

    switch (message.status) {
        case "sent":
            return "✓";
        case "delivered":
            return "✓✓";
        case "read":
            return "✓✓✓";
        default:
            return null;
    }
}
export function sortChats(chats) {
    return [...chats].sort((a, b) => {
        // pinned всегда выше
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        const aTime = a.messages.at(-1)?.id ?? 0;
        const bTime = b.messages.at(-1)?.id ?? 0;

        return bTime - aTime;
    });
}