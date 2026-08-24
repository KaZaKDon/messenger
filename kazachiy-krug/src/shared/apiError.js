export async function readApiError(response, fallback = "Ошибка запроса") {
    const text = await response.text().catch(() => "");
    if (!text) return fallback;

    try {
        const payload = JSON.parse(text);
        return payload?.error || payload?.message || fallback;
    } catch {
        return text;
    }
}

