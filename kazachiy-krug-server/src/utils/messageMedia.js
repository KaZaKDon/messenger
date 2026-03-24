export function getLegacyImageUrls(message) {
    return [
        typeof message?.imageUrl === "string" ? message.imageUrl : null,
        ...(Array.isArray(message?.imageUrls) ? message.imageUrls : []),
    ]
        .filter((url) => typeof url === "string")
        .map((url) => url.trim())
        .filter(Boolean);
}

function normalizeMediaType(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function getImageAttachmentUrls(message) {
    if (!Array.isArray(message?.attachments)) return [];

    return message.attachments
        .filter((attachment) => normalizeMediaType(attachment?.mediaType) === "image")
        .map((attachment) => (typeof attachment?.url === "string" ? attachment.url.trim() : ""))
        .filter(Boolean);
}

export function getAllImageUrls(message) {
    return [...new Set([...getLegacyImageUrls(message), ...getImageAttachmentUrls(message)])];
}

export function hasImageContent(message) {
    return getAllImageUrls(message).length > 0;
}
kazachiy-krug/src/screens/Chat/Chat.jsxkazachiy-krug/src/screens/Chat/Chat.jsx