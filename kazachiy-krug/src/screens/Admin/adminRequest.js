import { API_BASE_URL } from "../../shared/config";

export async function adminRequest(path, options = {}) {
    const token = sessionStorage.getItem("accessToken");
    const hasBody = options.body !== undefined;
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(hasBody ? { "Content-Type": "application/json" } : {}),
            ...options.headers,
        },
        body: hasBody && typeof options.body !== "string"
            ? JSON.stringify(options.body)
            : options.body,
    });

    const text = await response.text();
    let payload = null;
    if (text) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = null;
        }
    }

    if (!response.ok) {
        throw new Error(payload?.error || "Не удалось выполнить действие");
    }

    return payload;
}

