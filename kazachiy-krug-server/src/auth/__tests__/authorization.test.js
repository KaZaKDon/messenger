import assert from "node:assert/strict";
import test from "node:test";

import { requireAdmin, requireModeratorOrAdmin } from "../authorization.js";
import { publicUser } from "../publicUser.js";

function createResponse() {
    return {
        statusCode: 200,
        payload: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.payload = payload;
            return this;
        },
    };
}

test("publicUser returns the role without exposing account secrets", () => {
    const result = publicUser({
        id: "user-1",
        login: "admin",
        name: "Администратор",
        phone: "+70000000000",
        avatar: undefined,
        status: "active",
        role: "admin",
        passwordHash: "secret-hash",
        approvalCode: "123456",
    });

    assert.deepEqual(result, {
        id: "user-1",
        login: "admin",
        name: "Администратор",
        phone: "+70000000000",
        avatar: null,
        status: "active",
        role: "admin",
    });
    assert.equal("passwordHash" in result, false);
    assert.equal("approvalCode" in result, false);
});

test("requireAdmin allows an administrator", () => {
    const response = createResponse();
    let nextCalled = false;

    requireAdmin({ auth: { user: { role: "admin" } } }, response, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload, null);
});

test("requireAdmin rejects a regular user", () => {
    const response = createResponse();
    let nextCalled = false;

    requireAdmin({ auth: { user: { role: "user" } } }, response, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.payload, { error: "Недостаточно прав" });
});

test("requireAdmin rejects a moderator", () => {
    const response = createResponse();
    let nextCalled = false;

    requireAdmin({ auth: { user: { role: "moderator" } } }, response, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.payload, { error: "Недостаточно прав" });
});

test("requireModeratorOrAdmin allows an administrator", () => {
    const response = createResponse();
    let nextCalled = false;

    requireModeratorOrAdmin({ auth: { user: { role: "admin" } } }, response, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload, null);
});

test("requireModeratorOrAdmin allows a moderator", () => {
    const response = createResponse();
    let nextCalled = false;

    requireModeratorOrAdmin({ auth: { user: { role: "moderator" } } }, response, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload, null);
});

test("requireModeratorOrAdmin rejects a regular user", () => {
    const response = createResponse();
    let nextCalled = false;

    requireModeratorOrAdmin({ auth: { user: { role: "user" } } }, response, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.payload, { error: "Недостаточно прав" });
});
