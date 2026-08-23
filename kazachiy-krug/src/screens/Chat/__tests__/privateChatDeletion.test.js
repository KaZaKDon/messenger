import test from "node:test";
import assert from "node:assert/strict";
import { chatReducer, initialState } from "../chatReducer.js";

test("personal chat deletion removes it from the list and closes the active chat", () => {
    const chatId = "room-user-1-user-2";
    const state = {
        ...initialState,
        activeChatId: chatId,
        activeChatUserId: "user-2",
        chats: {
            [chatId]: {
                id: chatId,
                type: "private",
                messages: [{ id: "message-1", text: "Привет" }],
            },
            "group-12": { id: "group-12", type: "group", messages: [] },
        },
    };

    const next = chatReducer(state, {
        type: "DELETE_PRIVATE_CHAT",
        payload: { chatId },
    });

    assert.equal(next.chats[chatId], undefined);
    assert.ok(next.chats["group-12"]);
    assert.equal(next.activeChatId, null);
    assert.equal(next.activeChatUserId, null);
});

test("private dialogs are restored from server summaries after page reload", () => {
    const chatId = "room-user-1-user-2";
    const next = chatReducer(initialState, {
        type: "HYDRATE_PRIVATE_DIALOGS",
        payload: [{
            chatId,
            type: "private",
            members: ["user-1", "user-2"],
            otherUser: { id: "user-2", name: "Второй" },
            messages: [{
                id: "message-2",
                chatId,
                senderId: "user-2",
                text: "Новое сообщение",
                status: "delivered",
                createdAt: 1787389200000,
            }],
            unreadCount: 3,
        }],
    });

    assert.equal(next.chats[chatId].messages.length, 1);
    assert.equal(next.chats[chatId].messages[0].text, "Новое сообщение");
    assert.equal(next.chats[chatId].otherUser.id, "user-2");
    assert.equal(next.chats[chatId].unreadCount, 3);
});

test("opening a private chat clears its unread counter", () => {
    const chatId = "room-user-1-user-2";
    const state = {
        ...initialState,
        chats: { [chatId]: { id: chatId, type: "private", messages: [], unreadCount: 4 } },
    };
    const next = chatReducer(state, {
        type: "SET_ACTIVE_CHAT",
        payload: { chatId, type: "private", messages: [] },
    });
    assert.equal(next.chats[chatId].unreadCount, 0);
});

test("incoming message increments unread only outside the active chat", () => {
    const chatId = "room-user-1-user-2";
    const state = {
        ...initialState,
        activeChatId: null,
        chats: { [chatId]: { id: chatId, type: "private", messages: [], unreadCount: 1 } },
    };
    const next = chatReducer(state, {
        type: "RECEIVE_MESSAGE",
        payload: { chatId, currentUserId: "user-1", message: { id: "m-1", senderId: "user-2" } },
    });
    assert.equal(next.chats[chatId].unreadCount, 2);
});
