import assert from "node:assert/strict";
import test from "node:test";

import { findRegistrationStatus } from "../statusService.js";

const REGISTRATION_ID = "b0e4a3bd-9983-49cd-813a-6a495d914ef0";

function createPrisma(application, capture) {
    return {
        registrationApplication: {
            async findFirst(query) {
                capture.query = query;
                return application;
            },
        },
    };
}

test("registration status remains available by id after approval code is cleared", async () => {
    const capture = {};
    const expiresAt = new Date("2026-08-18T12:00:00.000Z");
    const result = await findRegistrationStatus({
        prisma: createPrisma({ expiresAt, user: { status: "active" } }, capture),
        source: {
            registrationId: REGISTRATION_ID,
            phone: "8 (999) 000-00-01",
        },
    });

    assert.deepEqual(capture.query.where, {
        userId: REGISTRATION_ID,
        user: { phone: "+79990000001" },
    });
    assert.deepEqual(result, { status: "active", expiresAt });
});

test("registration status keeps the four-digit lookup for older clients", async () => {
    const capture = {};
    await findRegistrationStatus({
        prisma: createPrisma({
            expiresAt: new Date("2026-08-18T12:00:00.000Z"),
            user: { status: "pending" },
        }, capture),
        source: { approvalCode: "3345", phone: "+79990000001" },
        now: new Date("2026-08-16T12:00:00.000Z"),
    });

    assert.deepEqual(capture.query.where, {
        approvalCode: "3345",
        user: { phone: "+79990000001" },
    });
});

test("expired pending registration is reported as expired", async () => {
    const result = await findRegistrationStatus({
        prisma: createPrisma({
            expiresAt: new Date("2026-08-18T12:00:00.000Z"),
            user: { status: "pending" },
        }, {}),
        source: { registrationId: REGISTRATION_ID, phone: "+79990000001" },
        now: new Date("2026-08-18T12:00:00.000Z"),
    });

    assert.equal(result.status, "expired");
});

test("invalid registration status credentials fail closed", async () => {
    let called = false;
    const prisma = {
        registrationApplication: {
            async findFirst() {
                called = true;
                return null;
            },
        },
    };

    const result = await findRegistrationStatus({
        prisma,
        source: { registrationId: "../unsafe", phone: "123" },
    });

    assert.equal(result, null);
    assert.equal(called, false);
});
