export function authHeaders(storage = globalThis.sessionStorage) {
    const token = storage?.getItem?.("accessToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
}
