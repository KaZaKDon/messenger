import { API_BASE_URL, BACKEND_ENABLED } from "../../shared/config";

export class AuthRequestError extends Error {
    constructor(message, { status = 0, field = null, payload = null } = {}) {
        super(message);
        this.name = "AuthRequestError";
        this.status = status;
        this.field = field;
        this.payload = payload;
    }
}

async function post(path, body) {
    if (!BACKEND_ENABLED) {
        throw new AuthRequestError("Мессенджер готовится к запуску. Попробуйте войти немного позже");
    }

    let response;
    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    } catch {
        throw new AuthRequestError("Сервер недоступен. Проверьте подключение и повторите попытку");
    }

    let payload;
    try {
        payload = await response.json();
    } catch {
        throw new AuthRequestError("Сервер вернул некорректный ответ", { status: response.status });
    }

    if (!response.ok) {
        throw new AuthRequestError(payload.error || "Не удалось выполнить запрос", {
            status: response.status,
            field: payload.field ?? null,
            payload,
        });
    }

    return payload;
}

export const authApi = Object.freeze({
    login: (credentials) => post("/auth/login", credentials),
    register: (application) => post("/auth/register", application),
    registrationStatus: (registration) => post("/auth/registration-status", registration),
    startRecovery: (source) => post("/auth/recovery", source),
    recoveryStatus: (credential) => post("/auth/recovery/status", credential),
    resetPassword: (source) => post("/auth/recovery/reset", source),
});
