import assert from "node:assert/strict";
import test from "node:test";

import {
    filterManagedGroups,
    groupCounters,
    groupKindLabel,
} from "../groupManagementModel.js";

const groups = [
    { chatId: "group-1", title: "Нужное", status: "active", visibility: "public", contentType: "notice", publishPolicy: "admin_moderator" },
    { chatId: "group-13", title: "010", status: "active", visibility: "private", contentType: "chat", publishPolicy: "members", isVip: false },
    { chatId: "group-paid", title: "Мастерская", status: "disabled", visibility: "public", contentType: "advertisement", publishPolicy: "owner" },
];

test("group counters separate active, private and softly disabled groups", () => {
    assert.deepEqual(groupCounters(groups), { total: 3, active: 2, private: 1, disabled: 1 });
});

test("group search checks title, id and derived kind", () => {
    assert.deepEqual(filterManagedGroups(groups, { query: "010" }).map((item) => item.chatId), ["group-13"]);
    assert.deepEqual(filterManagedGroups(groups, { query: "владельца" }).map((item) => item.chatId), ["group-paid"]);
});

test("private filter is independent from lifecycle status", () => {
    assert.deepEqual(filterManagedGroups(groups, { status: "private" }).map((item) => item.chatId), ["group-13"]);
});

test("VIP label has priority over other private group labels", () => {
    assert.equal(groupKindLabel({ ...groups[1], isVip: true }), "VIP");
    assert.equal(groupKindLabel(groups[1]), "Закрытая группа");
});

test("selected-author publication is not labelled as a public category", () => {
    assert.equal(groupKindLabel({
        visibility: "public",
        contentType: "advertisement",
        publishPolicy: "selected_authors",
    }), "Объявления назначенных авторов");
});
