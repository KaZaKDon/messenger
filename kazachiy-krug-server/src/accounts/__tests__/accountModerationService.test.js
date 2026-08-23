import test from "node:test";
import assert from "node:assert/strict";

import {
    blockUser,
    softDeleteUser,
    unblockUser,
} from "../accountModerationService.js";

function makePrisma(target) {
    const calls = {
        updates: [],
        sessionDeletes: [],
        advertisementUpdates: [],
        groupUpdates: [],
        publisherDeletes: [],
        audits: [],
    };
    const tx = {
        user: {
            update: async (query) => {
                calls.updates.push(query);
                return { ...target, ...query.data };
            },
        },
        session: { deleteMany: async (query) => calls.sessionDeletes.push(query) },
        advertisement: { updateMany: async (query) => calls.advertisementUpdates.push(query) },
        groupRule: { updateMany: async (query) => calls.groupUpdates.push(query) },
        groupPublisher: { deleteMany: async (query) => calls.publisherDeletes.push(query) },
        auditLog: { create: async (query) => calls.audits.push(query) },
    };
    return {
        calls,
        user: { findUnique: async () => target },
        $transaction: async (callback) => callback(tx),
    };
}

test("moderator can block a regular user and every session is revoked", async () => {
    const prisma = makePrisma({ id: "user-2", role: "user", status: "active" });
    const user = await blockUser({
        prisma,
        actor: { id: "moderator-1", role: "moderator" },
        userId: "user-2",
        reason: "Нарушение правил",
        now: new Date("2026-08-16T10:00:00Z"),
    });
    assert.equal(user.status, "blocked");
    assert.deepEqual(prisma.calls.sessionDeletes, [{ where: { userId: "user-2" } }]);
    assert.equal(prisma.calls.audits[0].data.action, "user.block");
});

test("moderator cannot block another moderator", async () => {
    const prisma = makePrisma({ id: "moderator-2", role: "moderator", status: "active" });
    await assert.rejects(
        blockUser({
            prisma,
            actor: { id: "moderator-1", role: "moderator" },
            userId: "moderator-2",
            reason: "Проверка ограничения",
        }),
        (error) => error.code === "ROLE_PROTECTED",
    );
});

test("only administrator can unblock an account", async () => {
    const prisma = makePrisma({ id: "user-2", role: "user", status: "blocked" });
    await assert.rejects(
        unblockUser({
            prisma,
            actor: { id: "moderator-1", role: "moderator" },
            userId: "user-2",
        }),
        (error) => error.code === "FORBIDDEN",
    );
});

test("soft deletion preserves the user row and revokes sessions", async () => {
    const prisma = makePrisma({ id: "user-2", role: "user", status: "active" });
    const user = await softDeleteUser({
        prisma,
        actor: { id: "admin-1", role: "admin" },
        userId: "user-2",
        reason: "Удаление по решению администратора",
    });
    assert.equal(user.status, "deleted");
    assert.equal(prisma.calls.updates.length, 1);
    assert.equal(prisma.calls.audits[0].data.action, "user.soft_delete");
    assert.deepEqual(prisma.calls.sessionDeletes, [{ where: { userId: "user-2" } }]);
    assert.equal(prisma.calls.advertisementUpdates[0].data.status, "removed");
    assert.equal(prisma.calls.groupUpdates[0].data.ownerId, null);
    assert.deepEqual(prisma.calls.publisherDeletes, [{ where: { userId: "user-2" } }]);
});

test("administrator account is protected from soft deletion", async () => {
    const prisma = makePrisma({ id: "admin-2", role: "admin", status: "active" });
    await assert.rejects(
        softDeleteUser({
            prisma,
            actor: { id: "admin-1", role: "admin" },
            userId: "admin-2",
            reason: "Проверка защиты администратора",
        }),
        (error) => error.code === "ADMIN_PROTECTED",
    );
});
