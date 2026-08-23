export const ACTIVE_CHAT_EVENT = "kazachiy:active-chat-changed";

let currentActiveChatId = null;

export function announceActiveChat(chatId) {
    currentActiveChatId = chatId || null;
    window.dispatchEvent(new CustomEvent(ACTIVE_CHAT_EVENT, {
        detail: { chatId: currentActiveChatId },
    }));
}

export function getAnnouncedActiveChat() {
    return currentActiveChatId;
}

export function unreadMapFromDialogs(dialogs) {
    const result = {};
    for (const dialog of Array.isArray(dialogs) ? dialogs : []) {
        if (dialog?.type !== "private" || !dialog.chatId) continue;
        result[dialog.chatId] = Math.max(0, Number(dialog.unreadCount) || 0);
    }
    return result;
}

export function totalUnread(unreadByChat) {
    return Object.values(unreadByChat ?? {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

export function applyIncomingUnread(unreadByChat, message, currentUserId, activeChatId) {
    if (!message?.chatId?.startsWith?.("room-") || message.senderId === currentUserId) return unreadByChat;
    if (message.chatId === activeChatId) return { ...unreadByChat, [message.chatId]: 0 };
    return {
        ...unreadByChat,
        [message.chatId]: (unreadByChat?.[message.chatId] ?? 0) + 1,
    };
}
