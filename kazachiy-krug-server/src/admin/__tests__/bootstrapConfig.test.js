import assert from "node:assert/strict";
import test from "node:test";

import { readAdminBootstrapConfig } from "../bootstrapConfig.js";

const VALID_ENV = {
    ADMIN_USER_ID: "user-1",
    ADMIN_LOGIN: "kazak.admin",
    ADMIN_PASSWORD: "strong-password-123",
    ADMIN_EMAIL: "Admin@Example.com",
};

test("admin bootstrap config targets an existing user and normalizes email", () => {
    assert.deepEqual(readAdminBootstrapConfig(VALID_ENV), {
        userId: "user-1",
        login: "kazak.admin",
        password: "strong-password-123",
        email: "admin@example.com",
    });
});

test("admin bootstrap config requires an explicit target user", () => {
    assert.throws(
        () => readAdminBootstrapConfig({ ...VALID_ENV, ADMIN_USER_ID: "" }),
        /ADMIN_USER_ID is required/,
    );
});

test("admin bootstrap config rejects invalid credentials", () => {
    assert.throws(
        () => readAdminBootstrapConfig({ ...VALID_ENV, ADMIN_LOGIN: "админ" }),
        /ADMIN_LOGIN/,
    );
    assert.throws(
        () => readAdminBootstrapConfig({ ...VALID_ENV, ADMIN_PASSWORD: "short" }),
        /ADMIN_PASSWORD/,
    );
    assert.throws(
        () => readAdminBootstrapConfig({ ...VALID_ENV, ADMIN_EMAIL: "not-an-email" }),
        /ADMIN_EMAIL/,
    );
});
