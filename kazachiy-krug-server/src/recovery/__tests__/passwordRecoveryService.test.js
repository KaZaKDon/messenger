import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
    completePasswordRecovery,
    createPasswordRecoveryRequest,
    PasswordRecoveryError,
    RECOVERY_TTL_MS,
    reviewPasswordRecovery,
} from "../passwordRecoveryService.js";

test("password recovery creates one three-day browser-bound request", async () => {
    const now = new Date("2026-08-22T10:00:00.000Z");
    const created = [];
    const prisma = {
        user: { findUnique: async () => ({ id: "user-1", status: "active" }) },
        passwordRecoveryRequest: {
            count: async () => 0,
            findFirst: async () => null,
            updateMany: async (query) => query,
            create: async ({ data }) => {
                const row = { id: "recovery-1", createdAt: now, ...data };
                created.push(row);
                return row;
            },
        },
        $transaction: async (operation) => operation({ passwordRecoveryRequest: prisma.passwordRecoveryRequest }),
    };

    const result = await createPasswordRecoveryRequest({
        prisma,
        phone: "8 999 000-00-01",
        now,
        randomIntFn: () => 1234,
    });

    assert.equal(result.requestCode, "1234");
    assert.equal(result.recoveryId, "recovery-1");
    assert.ok(result.browserSecret.length >= 32);
    assert.equal(result.expiresAt.getTime() - now.getTime(), RECOVERY_TTL_MS);
    assert.notEqual(created[0].clientSecretHash, result.browserSecret);
});

test("password recovery requires a Russian mobile phone", async () => {
    await assert.rejects(
        createPasswordRecoveryRequest({ prisma: {}, phone: "+1 555 123 4567" }),
        (error) => error instanceof PasswordRecoveryError && error.field === "phone",
    );
});

test("administrator approval records the decision and audit event", async () => {
    const now = new Date("2026-08-22T11:00:00.000Z");
    const writes = [];
    const prisma = {
        passwordRecoveryRequest: {
            findUnique: async () => ({ id: "request-1", userId: "user-1", status: "pending", expiresAt: new Date(now.getTime() + 1000) }),
            update: async ({ data }) => data,
            updateMany: async ({ data }) => { writes.push(data); return { count: 1 }; },
        },
        auditLog: { create: async ({ data }) => data },
        $transaction: async (operation) => operation(prisma),
    };

    const result = await reviewPasswordRecovery({ prisma, requestId: "request-1", adminId: "admin-1", source: { decision: "approve" }, now });
    assert.equal(result.status, "approved");
    assert.equal(writes[0].reviewedById, "admin-1");
});

test("approved recovery changes password and revokes every session", async () => {
    const now = new Date("2026-08-22T12:00:00.000Z");
    const secret = "browser-secret";
    const secretHash = createHash("sha256").update(secret).digest("hex");
    let deletedSessionsFor = null;
    let passwordHash = null;
    const prisma = {
        passwordRecoveryRequest: {
            findUnique: async () => ({ id: "request-1", userId: "user-1", status: "approved", reviewedById: "admin-1", clientSecretHash: secretHash, expiresAt: new Date(now.getTime() + 1000) }),
            update: async ({ data }) => data,
            updateMany: async () => ({ count: 1 }),
        },
        user: { update: async ({ data }) => { passwordHash = data.passwordHash; return data; } },
        session: { deleteMany: async ({ where }) => { deletedSessionsFor = where.userId; return { count: 2 }; } },
        auditLog: { create: async ({ data }) => data },
        $transaction: async (operation) => operation(prisma),
    };

    const result = await completePasswordRecovery({
        prisma,
        source: { recoveryId: "request-1", browserSecret: secret, password: "new-password", passwordConfirmation: "new-password" },
        now,
        hashPasswordFn: async () => "new-hash",
    });
    assert.equal(result.status, "completed");
    assert.equal(passwordHash, "new-hash");
    assert.equal(deletedSessionsFor, "user-1");
});
