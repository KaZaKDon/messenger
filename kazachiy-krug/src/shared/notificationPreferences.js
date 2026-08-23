export const NOTIFICATION_PREFERENCES_EVENT = "kazachiy:notification-preferences-changed";
export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
    messageSound: true,
    callSound: true,
    messageBrowser: true,
    callBrowser: true,
});

const STORAGE_KEY = "notificationPreferences";

export function readNotificationPreferences(storage = localStorage) {
    try {
        const saved = JSON.parse(storage.getItem(STORAGE_KEY) || "{}");
        return {
            messageSound: saved.messageSound !== false,
            callSound: saved.callSound !== false,
            messageBrowser: saved.messageBrowser !== false,
            callBrowser: saved.callBrowser !== false,
        };
    } catch {
        return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }
}

export function writeNotificationPreferences(preferences, storage = localStorage) {
    const normalized = {
        messageSound: preferences?.messageSound !== false,
        callSound: preferences?.callSound !== false,
        messageBrowser: preferences?.messageBrowser !== false,
        callBrowser: preferences?.callBrowser !== false,
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFERENCES_EVENT, { detail: normalized }));
    return normalized;
}
