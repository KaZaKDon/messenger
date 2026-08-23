import test from "node:test";
import assert from "node:assert/strict";
import {
    canOpenAdminSection,
    getAdminNavigation,
    getAdminPageTitle,
    isAdminRole,
} from "../adminNavigation.js";
import { buildAdminSummary } from "../adminSummary.js";

test("admin navigation contains administrator-only sections", () => {
    const ids = getAdminNavigation("admin").map((item) => item.id);
    assert.ok(ids.includes("payments"));
    assert.ok(ids.includes("moderators"));
    assert.ok(ids.includes("settlements"));
});

test("moderator navigation hides administrator-only sections", () => {
    const ids = getAdminNavigation("moderator").map((item) => item.id);
    assert.equal(ids.includes("payments"), false);
    assert.equal(ids.includes("moderators"), false);
    assert.equal(ids.includes("settlements"), false);
    assert.equal(canOpenAdminSection("moderator", "complaints"), true);
});

test("only administrator and moderator roles can enter the admin shell", () => {
    assert.equal(isAdminRole("admin"), true);
    assert.equal(isAdminRole("moderator"), true);
    assert.equal(isAdminRole("user"), false);
});

test("registration route has a specific mobile title", () => {
    assert.equal(
        getAdminPageTitle("/admin/users/registrations", "admin"),
        "Заявки на регистрацию",
    );
});

test("admin summary counts active queues and roles", () => {
    const summary = buildAdminSummary({
        role: "admin",
        adminUsers: {
            total: 4,
            users: [
                { role: "admin", status: "active" },
                { role: "moderator", status: "active" },
                { role: "moderator", status: "blocked" },
                { role: "user", status: "active" },
            ],
        },
        registrations: [{ id: "registration-1" }],
        passwordRecoveries: [{ id: "recovery-1" }],
        advertisements: [{ status: "active" }, { status: "deleted" }],
        complaints: [{ status: "new" }, { status: "resolved" }],
        supportRequests: [{ status: "in_progress" }],
        payments: [{ id: "payment-1" }],
    });

    assert.deepEqual(summary, {
        users: 4,
        pendingRegistrations: 1,
        pendingPasswordRecoveries: 1,
        blockedUsers: 1,
        groups: null,
        advertisements: 1,
        complaints: 1,
        supportRequests: 1,
        payments: 1,
        moderators: 1,
    });
});
