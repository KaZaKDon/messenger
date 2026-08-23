import test from "node:test";
import assert from "node:assert/strict";
import {
    getBrowserNotificationPermission,
    requestBrowserNotificationPermission,
    shouldShowBrowserNotification,
    showBrowserNotification,
} from "../browserNotifications.js";

test("browser notification support and permission are detected safely", async () => {
    assert.equal(getBrowserNotificationPermission(undefined), "unsupported");
    assert.equal(getBrowserNotificationPermission({ permission: "granted" }), "granted");
    assert.equal(await requestBrowserNotificationPermission(undefined), "unsupported");
});

test("system notification is shown only for an unfocused background app", () => {
    assert.equal(shouldShowBrowserNotification({
        enabled: true,
        permission: "granted",
        visibilityState: "hidden",
        hasFocus: false,
    }), true);
    assert.equal(shouldShowBrowserNotification({
        enabled: true,
        permission: "granted",
        visibilityState: "visible",
        hasFocus: true,
    }), false);
    assert.equal(shouldShowBrowserNotification({
        enabled: false,
        permission: "granted",
        visibilityState: "hidden",
        hasFocus: false,
    }), false);
});

test("notification click focuses the app and runs its navigation action", () => {
    let created = null;
    let focused = false;
    let opened = false;
    class NotificationApi {
        static permission = "granted";
        constructor(title, options) {
            created = this;
            this.title = title;
            this.options = options;
        }
        close() {}
    }

    const notification = showBrowserNotification({
        title: "Вам сообщение от Димы",
        tag: "message-room-1",
        NotificationApi,
        documentApi: { visibilityState: "hidden", hasFocus: () => false },
        windowApi: { focus: () => { focused = true; } },
        onClick: () => { opened = true; },
    });

    assert.equal(notification, created);
    assert.equal(created.title, "Вам сообщение от Димы");
    assert.equal(created.options.body, undefined);
    created.onclick();
    assert.equal(focused, true);
    assert.equal(opened, true);
});
