export const callsById = new Map();

export function upsertCall(call) {
    if (!call?.id) return null;
    callsById.set(call.id, call);
    return call;
}

export function getCallById(callId) {
    return callsById.get(callId) ?? null;
}

export function listCallsByChatId(chatId) {
    return [...callsById.values()]
        .filter((call) => call.chatId === chatId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
