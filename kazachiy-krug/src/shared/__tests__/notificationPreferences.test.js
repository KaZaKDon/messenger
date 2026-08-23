import test from "node:test";
import assert from "node:assert/strict";
import { readNotificationPreferences } from "../notificationPreferences.js";

function storage(value) {
    return { getItem: () => value };
}

test("notification preferences are enabled by default", () => {
    assert.deepEqual(readNotificationPreferences(storage(null)), {
        messageSound: true,
        callSound: true,
        messageBrowser: true,
        callBrowser: true,
    });
});

test("saved notification sound switches are restored", () => {
    assert.deepEqual(
        readNotificationPreferences(storage('{"messageSound":false,"callSound":true}')),
        { messageSound: false, callSound: true, messageBrowser: true, callBrowser: true }
    );
});

test("invalid notification preferences fail safely", () => {
    assert.deepEqual(readNotificationPreferences(storage("broken")), {
        messageSound: true,
        callSound: true,
        messageBrowser: true,
        callBrowser: true,
    });
});
