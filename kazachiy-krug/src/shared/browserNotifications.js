export function getBrowserNotificationPermission(NotificationApi = globalThis.Notification) {
    if (!NotificationApi) return "unsupported";
    return NotificationApi.permission ?? "default";
}

export async function requestBrowserNotificationPermission(NotificationApi = globalThis.Notification) {
    if (!NotificationApi?.requestPermission) return "unsupported";
    try {
        return await NotificationApi.requestPermission();
    } catch {
        return "denied";
    }
}

export function shouldShowBrowserNotification({
    enabled,
    permission,
    visibilityState,
    hasFocus,
}) {
    return Boolean(enabled)
        && permission === "granted"
        && (visibilityState !== "visible" || hasFocus === false);
}

export function showBrowserNotification({
    title,
    tag,
    enabled = true,
    onClick,
    NotificationApi = globalThis.Notification,
    documentApi = globalThis.document,
    windowApi = globalThis.window,
}) {
    const permission = getBrowserNotificationPermission(NotificationApi);
    const visibilityState = documentApi?.visibilityState ?? "visible";
    const hasFocus = documentApi?.hasFocus?.() ?? true;

    if (!shouldShowBrowserNotification({ enabled, permission, visibilityState, hasFocus })) {
        return null;
    }

    try {
        const notification = new NotificationApi(title, {
            tag,
            silent: true,
        });
        notification.onclick = () => {
            windowApi?.focus?.();
            notification.close?.();
            onClick?.();
        };
        return notification;
    } catch {
        return null;
    }
}
