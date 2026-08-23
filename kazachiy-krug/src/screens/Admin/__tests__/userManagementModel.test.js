import test from "node:test";
import assert from "node:assert/strict";
import {
    filterManagedUsers,
    getAllowedUserActions,
    normalizeUserListResponse,
} from "../userManagementModel.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const detailsSource = readFileSync(fileURLToPath(new URL("../components/AdminUserDetails.jsx", import.meta.url)), "utf8");

test("administrator user response keeps server counters", () => {
    const result = normalizeUserListResponse("admin", {
        users: [{ id: "user-1", status: "active" }],
        counts: { active: 2, pending: 1 },
        total: 3,
    });

    assert.equal(result.total, 3);
    assert.equal(result.counts.active, 2);
    assert.equal(result.counts.pending, 1);
    assert.equal(result.counts.deleted, 0);
});

test("moderator user response calculates only visible counters", () => {
    const result = normalizeUserListResponse("moderator", [
        { id: "user-1", status: "active" },
        { id: "user-2", status: "blocked" },
    ]);

    assert.equal(result.total, 2);
    assert.equal(result.counts.active, 1);
    assert.equal(result.counts.blocked, 1);
    assert.equal(result.counts.pending, 0);
});

test("user search checks name, normalized phone, email and login", () => {
    const users = [
        { id: "1", name: "Иван Петров", phone: "+79990000001", email: "ivan@example.test", login: "ivan" },
        { id: "2", name: "Мария", phone: "+79990000002", email: null, login: null },
    ];

    assert.deepEqual(filterManagedUsers(users, { query: "петров" }).map((user) => user.id), ["1"]);
    assert.deepEqual(filterManagedUsers(users, { query: "000002" }).map((user) => user.id), ["2"]);
    assert.deepEqual(filterManagedUsers(users, { query: "IVAN@" }).map((user) => user.id), ["1"]);
});

test("status filter is combined with search", () => {
    const users = [
        { id: "1", name: "Иван", status: "active" },
        { id: "2", name: "Иван", status: "blocked" },
    ];

    assert.deepEqual(
        filterManagedUsers(users, { query: "Иван", status: "blocked" }).map((user) => user.id),
        ["2"],
    );
});

test("administrator can block, unblock and softly delete ordinary users", () => {
    assert.deepEqual(getAllowedUserActions({
        viewerRole: "admin",
        viewerId: "admin-1",
        user: { id: "user-1", role: "user", status: "active" },
    }), ["block", "delete"]);

    assert.deepEqual(getAllowedUserActions({
        viewerRole: "admin",
        viewerId: "admin-1",
        user: { id: "user-1", role: "user", status: "blocked" },
    }), ["unblock", "delete"]);
});

test("moderator can only block an active ordinary user", () => {
    assert.deepEqual(getAllowedUserActions({
        viewerRole: "moderator",
        viewerId: "moderator-1",
        user: { id: "user-1", role: "user", status: "active" },
    }), ["block"]);

    assert.deepEqual(getAllowedUserActions({
        viewerRole: "moderator",
        viewerId: "moderator-1",
        user: { id: "user-1", role: "user", status: "blocked" },
    }), []);
});

test("administrator and own accounts are protected from interface actions", () => {
    assert.deepEqual(getAllowedUserActions({
        viewerRole: "admin",
        viewerId: "admin-1",
        user: { id: "admin-2", role: "admin", status: "active" },
    }), []);

    assert.deepEqual(getAllowedUserActions({
        viewerRole: "admin",
        viewerId: "admin-1",
        user: { id: "admin-1", role: "admin", status: "active" },
    }), []);
});

test("moderator details display agreed private profile fields without admin secrets", () => {
    assert.match(detailsSource, /Имя и фамилия/);
    assert.match(detailsSource, /Населённый пункт/);
    assert.match(detailsSource, /Занятие/);
    assert.match(detailsSource, /Цель регистрации/);
    assert.match(detailsSource, /viewerRole === "admin"[\s\S]*?Email/);
    assert.match(detailsSource, /viewerRole === "admin"[\s\S]*?Логин/);
});
