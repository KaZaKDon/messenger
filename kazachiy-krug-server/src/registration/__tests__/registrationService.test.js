import assert from "node:assert/strict";
import test from "node:test";

import {
    createRegistrationApplication,
    RegistrationConflictError,
} from "../registrationService.js";

const SOURCE = {
    nickname: "Донской казак",
    phone: "8 (951) 123-45-67",
    email: "USER@example.com",
    password: "strong-password",
    passwordConfirmation: "strong-password",
    firstName: "Иван",
    lastName: "Петров",
    settlement: "станица Вёшенская",
    occupation: "Пчеловод",
    purposes: ["community", "publish_announcements"],
    acceptances: { termsRules: true, personalData: true, publicProfile: true },
};

const CONFIG = {
    contactPhone: "+79510000000",
    contactPhoneDisplay: "8 (951) 000-00-00",
    documentVersions: {
        terms_rules: "rules-v1",
        personal_data: "privacy-v1",
        public_profile: "profile-v1",
    },
};

function createFakePrisma({ duplicate = null } = {}) {
    const captured = {};
    const prisma = {
        user: {
            findFirst: async () => duplicate,
        },
        registrationApplication: {
            findUnique: async () => null,
        },
        $transaction: async (callback) => callback({
            user: {
                create: async ({ data }) => {
                    captured.user = data;
                    return { ...data, role: "user", avatar: null };
                },
            },
            registrationApplication: {
                create: async ({ data }) => {
                    captured.application = data;
                    return data;
                },
            },
            userProfile: {
                create: async ({ data }) => {
                    captured.profile = data;
                    return data;
                },
            },
            legalAcceptance: {
                createMany: async ({ data }) => {
                    captured.acceptances = data;
                    return { count: data.length };
                },
            },
        }),
    };
    return { prisma, captured };
}

test("registration service creates account, application and three acceptances atomically", async () => {
    const { prisma, captured } = createFakePrisma();
    const now = new Date("2026-08-15T12:00:00.000Z");
    const result = await createRegistrationApplication({
        prisma,
        source: SOURCE,
        config: CONFIG,
        metadata: { ipAddress: "127.0.0.1", userAgent: "test-agent" },
        now,
        createId: () => "new-user",
        hashPasswordFn: async () => "password-hash",
    });

    assert.equal(captured.user.id, "new-user");
    assert.equal(captured.user.login, null);
    assert.equal(captured.user.email, "user@example.com");
    assert.equal(captured.user.phone, "+79511234567");
    assert.equal(captured.user.status, "pending");
    assert.equal(captured.application.userId, "new-user");
    assert.equal(captured.application.approvalCode.length, 4);
    assert.deepEqual(captured.profile, {
        userId: "new-user",
        settlement: "станица Вёшенская",
        occupation: "Пчеловод",
    });
    assert.equal(captured.application.expiresAt.toISOString(), "2026-08-18T12:00:00.000Z");
    assert.deepEqual(
        captured.acceptances.map(({ type, documentVersion }) => [type, documentVersion]),
        [
            ["terms_rules", "rules-v1"],
            ["personal_data", "privacy-v1"],
            ["public_profile", "profile-v1"],
        ],
    );
    assert.ok(captured.acceptances.every((item) => item.acceptedAt.getTime() === now.getTime()));
    assert.equal(result.contactPhoneDisplay, CONFIG.contactPhoneDisplay);
});

test("registration service rejects a duplicate normalized phone", async () => {
    const { prisma } = createFakePrisma({
        duplicate: { phone: "+79511234567", email: null },
    });

    await assert.rejects(
        createRegistrationApplication({
            prisma,
            source: SOURCE,
            config: CONFIG,
            hashPasswordFn: async () => "password-hash",
        }),
        (error) => error instanceof RegistrationConflictError && error.field === "phone",
    );
});
