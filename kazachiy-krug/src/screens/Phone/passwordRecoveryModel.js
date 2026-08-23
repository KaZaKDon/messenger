export const RECOVERY_STORAGE_KEY = "passwordRecovery";

export function validRecoveryCredential(value) {
    return Boolean(
        value
        && typeof value.recoveryId === "string"
        && value.recoveryId
        && typeof value.browserSecret === "string"
        && value.browserSecret
        && /^\d{4}$/.test(String(value.requestCode ?? "")),
    );
}

export function readRecoveryCredential(storage = localStorage) {
    try {
        const value = JSON.parse(storage.getItem(RECOVERY_STORAGE_KEY));
        if (validRecoveryCredential(value)) return value;
    } catch {
        // Повреждённая локальная заявка не должна ломать форму входа.
    }
    storage.removeItem(RECOVERY_STORAGE_KEY);
    return null;
}

export function saveRecoveryCredential(value, storage = localStorage) {
    if (!validRecoveryCredential(value)) return false;
    storage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(value));
    return true;
}

export function clearRecoveryCredential(storage = localStorage) {
    storage.removeItem(RECOVERY_STORAGE_KEY);
}

export function recoveryCredential(value) {
    return { recoveryId: value.recoveryId, browserSecret: value.browserSecret };
}

export function effectiveRecoveryStatus(value, now = Date.now()) {
    if (!value) return "start";
    if (["pending", "approved"].includes(value.status)) {
        const expiresAt = new Date(value.expiresAt).getTime();
        if (Number.isFinite(expiresAt) && expiresAt <= now) return "expired";
    }
    return value.status ?? "pending";
}
