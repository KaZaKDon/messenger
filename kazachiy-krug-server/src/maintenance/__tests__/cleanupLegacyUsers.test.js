import assert from "node:assert/strict";
import test from "node:test";

import {
    buildLegacyUserCleanupPlan,
    CLEANUP_CONFIRMATION,
    readCleanupLegacyUsersConfig,
} from "../cleanupLegacyUsers.js";

const USERS = [
    { id: "user-1", role: "admin", status: "active", name: "Administrator" },
    { id: "user-2", role: "user", status: "active", name: "Legacy user" },
    { id: "user-3", role: "moderator", status: "active", name: "Legacy moderator" },
];

test("legacy cleanup requires an explicit protected administrator", () => {
    assert.throws(
        () => readCleanupLegacyUsersConfig({}, [`--confirm=${CLEANUP_CONFIRMATION}`]),
        /ADMIN_USER_ID is required/,
    );
});

test("legacy cleanup requires the exact destructive confirmation", () => {
    assert.throws(
        () => readCleanupLegacyUsersConfig({ ADMIN_USER_ID: "user-1" }, []),
        /Cleanup was not confirmed/,
    );
    assert.throws(
        () => readCleanupLegacyUsersConfig({ ADMIN_USER_ID: "user-1" }, ["--confirm=yes"]),
        /Cleanup was not confirmed/,
    );
});

test("legacy cleanup accepts the protected administrator and exact confirmation", () => {
    assert.deepEqual(
        readCleanupLegacyUsersConfig(
            { ADMIN_USER_ID: " user-1 " },
            [`--confirm=${CLEANUP_CONFIRMATION}`],
        ),
        { keepUserId: "user-1" },
    );
});

test("legacy cleanup refuses a missing or unsafe protected account", () => {
    assert.throws(
        () => buildLegacyUserCleanupPlan(USERS, "missing-user"),
        /was not found/,
    );
    assert.throws(
        () => buildLegacyUserCleanupPlan(USERS, "user-2"),
        /must be an active administrator/,
    );
});

test("legacy cleanup protects the administrator and targets every other account", () => {
    const plan = buildLegacyUserCleanupPlan(USERS, "user-1");

    assert.equal(plan.keepUser.id, "user-1");
    assert.deepEqual(plan.usersToDelete.map((user) => user.id), ["user-2", "user-3"]);
});
