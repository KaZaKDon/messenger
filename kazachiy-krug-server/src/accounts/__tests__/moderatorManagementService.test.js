import test from "node:test";
import assert from "node:assert/strict";

import { setModeratorRole } from "../moderatorManagementService.js";

function makePrisma(target) {
    const calls = { updates: [], sessions: [], audits: [] };
    const tx = {
        user: { update: async (query) => { calls.updates.push(query); return { ...target, ...query.data }; } },
        session: { deleteMany: async (query) => calls.sessions.push(query) },
        auditLog: { create: async (query) => calls.audits.push(query) },
    };
    return {
        calls,
        user: { findUnique: async () => target },
        $transaction: async (callback) => callback(tx),
    };
}

test("administrator assigns moderator role and revokes existing sessions", async () => {
    const prisma = makePrisma({ id: "user-2", role: "user", status: "active" });
    const result = await setModeratorRole({
        prisma,
        actor: { id: "admin-1", role: "admin" },
        userId: "user-2",
        assigned: true,
    });
    assert.equal(result.role, "moderator");
    assert.deepEqual(prisma.calls.sessions, [{ where: { userId: "user-2" } }]);
    assert.equal(prisma.calls.audits[0].data.action, "moderator.assign");
});

test("administrator removes moderator role without deleting the account", async () => {
    const prisma = makePrisma({ id: "moderator-2", role: "moderator", status: "active" });
    const result = await setModeratorRole({
        prisma,
        actor: { id: "admin-1", role: "admin" },
        userId: "moderator-2",
        assigned: false,
    });
    assert.equal(result.role, "user");
    assert.equal(prisma.calls.audits[0].data.action, "moderator.remove");
});

test("only an active ordinary user can become moderator", async () => {
    const prisma = makePrisma({ id: "user-2", role: "user", status: "blocked" });
    await assert.rejects(
        setModeratorRole({
            prisma,
            actor: { id: "admin-1", role: "admin" },
            userId: "user-2",
            assigned: true,
        }),
        (error) => error.code === "INVALID_MODERATOR_CANDIDATE",
    );
});

test("administrator and own account roles are protected", async () => {
    await assert.rejects(
        setModeratorRole({
            prisma: makePrisma({ id: "admin-2", role: "admin", status: "active" }),
            actor: { id: "admin-1", role: "admin" },
            userId: "admin-2",
            assigned: false,
        }),
        (error) => error.code === "ADMIN_PROTECTED",
    );
    await assert.rejects(
        setModeratorRole({
            prisma: makePrisma({ id: "admin-1", role: "admin", status: "active" }),
            actor: { id: "admin-1", role: "admin" },
            userId: "admin-1",
            assigned: false,
        }),
        (error) => error.code === "SELF_ROLE_CHANGE_FORBIDDEN",
    );
});
