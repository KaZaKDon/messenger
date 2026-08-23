import test from "node:test";
import assert from "node:assert/strict";

import {
    canAssignModerator,
    canRemoveModerator,
    filterModeratorUsers,
    moderatorCounters,
} from "../moderatorManagementModel.js";

const moderators = [
    { id: "m-1", name: "Иван", phone: "+79990000001", role: "moderator", status: "active" },
    { id: "m-2", name: "Пётр", phone: "+79990000002", role: "moderator", status: "blocked" },
];

test("moderator counters separate active, blocked and candidates", () => {
    assert.deepEqual(moderatorCounters({ moderators, candidates: [{ id: "u-1" }] }), {
        total: 2, active: 1, blocked: 1, candidates: 1,
    });
});

test("moderator search covers name, phone, email and login", () => {
    const users = [{ name: "Иван", phone: "+7999", email: "ivan@test.ru", login: "ataman" }];
    assert.equal(filterModeratorUsers(users, "атаман").length, 0);
    assert.equal(filterModeratorUsers(users, "ATAMAN").length, 1);
    assert.equal(filterModeratorUsers(users, "test.ru").length, 1);
});

test("role actions protect invalid candidates and own account", () => {
    assert.equal(canAssignModerator({ role: "user", status: "active" }), true);
    assert.equal(canAssignModerator({ role: "user", status: "blocked" }), false);
    assert.equal(canRemoveModerator(moderators[0], "m-1"), false);
    assert.equal(canRemoveModerator(moderators[1], "admin-1"), true);
});
