import test from "node:test";
import assert from "node:assert/strict";
import { applyIncomingUnread, totalUnread, unreadMapFromDialogs } from "../messengerNotifications.js";

test("personal unread total is restored from server dialogs", () => {
    const unread = unreadMapFromDialogs([
        { chatId: "room-1", type: "private", unreadCount: 2 },
        { chatId: "room-2", type: "private", unreadCount: 3 },
        { chatId: "group-4", type: "group", unreadCount: 9 },
    ]);
    assert.deepEqual(unread, { "room-1": 2, "room-2": 3 });
    assert.equal(totalUnread(unread), 5);
});

test("incoming private message increments only a closed dialog", () => {
    const initial = { "room-1": 1 };
    assert.deepEqual(
        applyIncomingUnread(initial, { chatId: "room-1", senderId: "user-2" }, "user-1", null),
        { "room-1": 2 }
    );
    assert.deepEqual(
        applyIncomingUnread(initial, { chatId: "room-1", senderId: "user-2" }, "user-1", "room-1"),
        { "room-1": 0 }
    );
});

test("own and group messages do not affect personal unread", () => {
    const initial = { "room-1": 1 };
    assert.equal(applyIncomingUnread(initial, { chatId: "room-1", senderId: "user-1" }, "user-1", null), initial);
    assert.equal(applyIncomingUnread(initial, { chatId: "group-4", senderId: "user-2" }, "user-1", null), initial);
});
