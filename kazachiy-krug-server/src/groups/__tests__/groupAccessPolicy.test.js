import test from "node:test";
import assert from "node:assert/strict";

import {
    canManageGroupMembers,
    canModerateGroup,
    canPublishToGroup,
    canViewGroup,
    isGroupOwnerActive,
} from "../groupAccessPolicy.js";

const user = { id: "user-2", role: "user" };
const moderator = { id: "moderator-1", role: "moderator" };
const admin = { id: "admin-1", role: "admin" };

test("public active group is visible without an explicit membership", () => {
    assert.equal(canViewGroup({ rule: { visibility: "public", status: "active" }, isMember: false }), true);
});

test("private group is visible only to an invited member", () => {
    const rule = { visibility: "private", status: "active" };
    assert.equal(canViewGroup({ rule, isMember: false }), false);
    assert.equal(canViewGroup({ rule, isMember: true }), true);
});

test("disabled and archived groups are hidden from messenger users", () => {
    assert.equal(canViewGroup({ rule: { visibility: "public", status: "disabled" } }), false);
    assert.equal(canViewGroup({ rule: { visibility: "public", status: "archived" } }), false);
});

test("admin_moderator policy allows only administrators and moderators", () => {
    const rule = { visibility: "public", status: "active", publishPolicy: "admin_moderator" };
    assert.equal(canPublishToGroup({ rule, user, isMember: false }), false);
    assert.equal(canPublishToGroup({ rule, user: moderator, isMember: false }), true);
    assert.equal(canPublishToGroup({ rule, user: admin, isMember: false }), true);
});

test("selected_authors policy does not grant publication by administrative role alone", () => {
    const rule = {
        visibility: "public",
        status: "active",
        publishPolicy: "selected_authors",
        publishers: [{ userId: "user-2" }],
    };

    assert.equal(canPublishToGroup({ rule, user, isMember: false }), true);
    assert.equal(canPublishToGroup({ rule, user: moderator, isMember: false }), false);
    assert.equal(canPublishToGroup({ rule, user: admin, isMember: false }), false);
});

test("selected_authors policy temporarily supports legacy publisher ids", () => {
    const rule = {
        visibility: "public",
        status: "active",
        publishPolicy: "selected_authors",
        publishers: [],
        publishUserIds: ["user-2"],
    };

    assert.equal(canPublishToGroup({ rule, user, isMember: false }), true);
});

test("members policy allows every viewer but still protects a private group", () => {
    const publicRule = { visibility: "public", status: "active", publishPolicy: "members" };
    const privateRule = { visibility: "private", status: "active", publishPolicy: "members" };

    assert.equal(canPublishToGroup({ rule: publicRule, user, isMember: false }), true);
    assert.equal(canPublishToGroup({ rule: privateRule, user, isMember: false }), false);
    assert.equal(canPublishToGroup({ rule: privateRule, user, isMember: true }), true);
});

test("owner policy observes the assigned ownership period", () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    const rule = {
        visibility: "public",
        status: "active",
        publishPolicy: "owner",
        ownerId: "user-2",
        ownershipStartsAt: new Date("2026-08-01T00:00:00.000Z"),
        ownershipEndsAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    assert.equal(isGroupOwnerActive(rule, now), true);
    assert.equal(canPublishToGroup({ rule, user, now }), true);
    assert.equal(canPublishToGroup({ rule, user, now: new Date("2026-09-01T00:00:00.000Z") }), false);
    assert.equal(canPublishToGroup({ rule, user: { id: "user-3", role: "user" }, now }), false);
});

test("moderation is global for administrator and moderator roles", () => {
    assert.equal(canModerateGroup(user), false);
    assert.equal(canModerateGroup(moderator), true);
    assert.equal(canModerateGroup(admin), true);
});

test("private group membership can be managed by administrator and moderator", () => {
    const privateRule = { visibility: "private" };
    const publicRule = { visibility: "public" };

    assert.equal(canManageGroupMembers({ rule: privateRule, user }), false);
    assert.equal(canManageGroupMembers({ rule: privateRule, user: moderator }), true);
    assert.equal(canManageGroupMembers({ rule: privateRule, user: admin }), true);
    assert.equal(canManageGroupMembers({ rule: publicRule, user: admin }), false);
});
