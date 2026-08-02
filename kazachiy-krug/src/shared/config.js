const DEFAULT_API_URL = "http://localhost:3000";

function trimTrailingSlashes(value) {
    return String(value ?? "").replace(/\/+$/, "");
}

export const API_BASE_URL = trimTrailingSlashes(
    import.meta.env.VITE_API_URL ?? import.meta.env.VITE_SOCKET_URL ?? DEFAULT_API_URL
);

export const SOCKET_URL = trimTrailingSlashes(
    import.meta.env.VITE_SOCKET_URL ?? API_BASE_URL
);
