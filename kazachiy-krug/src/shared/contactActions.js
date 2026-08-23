export function buildContactChatPath(contactId, callType = null) {
    if (!contactId) return "/chat";
    const params = new URLSearchParams({ user: String(contactId) });
    if (callType === "audio" || callType === "video") params.set("call", callType);
    return `/chat?${params.toString()}`;
}

export function filterContacts(contacts, query) {
    const normalized = String(query ?? "").trim().toLowerCase();
    if (!normalized) return Array.isArray(contacts) ? contacts : [];
    return (Array.isArray(contacts) ? contacts : []).filter((contact) => {
        const name = String(contact?.name ?? "").toLowerCase();
        const phone = String(contact?.phone ?? "").toLowerCase();
        return name.includes(normalized) || phone.includes(normalized);
    });
}
