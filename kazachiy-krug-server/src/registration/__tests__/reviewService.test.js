import assert from "node:assert/strict";
import test from "node:test";

import {
    RegistrationReviewError,
    reviewRegistrationApplication,
    validateRegistrationDecision,
} from "../reviewService.js";

test("registration rejection requires a reason", () => {
    assert.throws(
        () => validateRegistrationDecision({ decision: "reject", reason: "" }),
        (error) => error instanceof RegistrationReviewError && error.statusCode === 400,
    );
    assert.deepEqual(
        validateRegistrationDecision({ decision: "reject", reason: "  неверные данные  " }),
        { decision: "reject", reason: "неверные данные" },
    );
});

test("registration approval clears the code and records the administrator", async () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    const captured = {};
    const updatedUser = { id: "user-2", status: "active", name: "Иван" };
    const prisma = {
        user: {
            findUnique: async () => ({
                id: "user-2",
                status: "pending",
                registrationApplication: {
                    reviewedAt: null,
                    expiresAt: new Date("2026-08-18T12:00:00.000Z"),
                },
            }),
            update: (request) => {
                captured.userUpdate = request;
                return updatedUser;
            },
        },
        registrationApplication: {
            update: (request) => {
                captured.applicationUpdate = request;
                return request;
            },
        },
        auditLog: {
            create: (request) => {
                captured.audit = request;
                return request;
            },
        },
        $transaction: async (operations) => operations,
    };

    const user = await reviewRegistrationApplication({
        prisma,
        userId: "user-2",
        adminId: "user-1",
        source: { decision: "approve" },
        now,
    });

    assert.equal(user, updatedUser);
    assert.equal(captured.userUpdate.data.status, "active");
    assert.equal(captured.applicationUpdate.data.approvalCode, null);
    assert.equal(captured.applicationUpdate.data.reviewedById, "user-1");
    assert.equal(captured.applicationUpdate.data.reviewedAt, now);
    assert.equal(captured.audit.data.action, "registration.approve");
});

test("expired registration cannot be approved", async () => {
    const prisma = {
        user: {
            findUnique: async () => ({
                id: "user-2",
                status: "pending",
                registrationApplication: {
                    reviewedAt: null,
                    expiresAt: new Date("2026-08-14T12:00:00.000Z"),
                },
            }),
        },
    };

    await assert.rejects(
        reviewRegistrationApplication({
            prisma,
            userId: "user-2",
            adminId: "user-1",
            source: { decision: "approve" },
            now: new Date("2026-08-15T12:00:00.000Z"),
        }),
        (error) => error instanceof RegistrationReviewError && error.statusCode === 410,
    );
});
