const DEFAULT_API_URL = "http://localhost:3000";

function trimTrailingSlashes(value) {
    return String(value ?? "").replace(/\/+$/, "");
}

function readBoolean(value, fallback) {
    if (value == null || value === "") return fallback;
    return String(value).trim().toLowerCase() === "true";
}

export const API_BASE_URL = trimTrailingSlashes(
    import.meta.env.VITE_API_URL ?? import.meta.env.VITE_SOCKET_URL ?? DEFAULT_API_URL
);

export const SOCKET_URL = trimTrailingSlashes(
    import.meta.env.VITE_SOCKET_URL ?? API_BASE_URL
);

export const BACKEND_ENABLED = readBoolean(import.meta.env.VITE_BACKEND_ENABLED, true);

export const ADMIN_PHONE = import.meta.env.VITE_ADMIN_PHONE ?? "+79381532981";
export const ADMIN_PHONE_DISPLAY = import.meta.env.VITE_ADMIN_PHONE_DISPLAY ?? "8 (938) 153-29-81";
