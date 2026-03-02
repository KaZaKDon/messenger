function parseBoolean(value, defaultValue = false) {
    if (typeof value !== "string") return defaultValue;

    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;

    return defaultValue;
}

export const SOCKET_MEMORY_FALLBACK_ENABLED = parseBoolean(
    process.env.SOCKET_MEMORY_FALLBACK_ENABLED,
    false
);
