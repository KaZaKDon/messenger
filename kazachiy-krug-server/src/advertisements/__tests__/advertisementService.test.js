import test from "node:test";
import assert from "node:assert/strict";

import {
    advertisementExpiry,
    validateAdvertisementInput,
} from "../advertisementValidation.js";
import {
    createAdvertisement,
    extendAdvertisement,
    moderateAdvertisement,
} from "../advertisementService.js";

const actor = { id: "user-2", role: "user", status: "active" };
const source = {
    title: "Продам велосипед",
    settlement: "Станица Вёшенская",
    price: "15 000 ₽",
    description: "Исправен, состояние хорошее",
    images: ["/uploads/bike.jpg"],
};

function createPrisma({ count = 0, ruleOverrides = {} } = {}) {
    const rule = {
        chatId: "group-4",
        mode: "announcements",
        contentType: "advertisement",
        visibility: "public",
        publishPolicy: "members",
        status: "active",
        requiresAnnouncementWithImage: true,
        advertisementLifetimeDays: 7,
        publishers: [],
        ...ruleOverrides,
    };
    return {
        settlement: { findUnique: async () => ({ id: "settlement-1", name: source.settlement, isActive: true }) },
        groupRule: { findUnique: async () => rule },
        chatMember: { findUnique: async () => null },
        advertisement: {
            count: async () => count,
            create: async (query) => ({ id: "ad-1", ...query.data }),
        },
    };
}

test("advertisement input preserves image ordering", () => {
    const input = validateAdvertisementInput({
        ...source,
        images: Array.from({ length: 5 }, (_, index) => `/uploads/${index}.jpg`),
    }, { imageRequired: true });
    assert.equal(input.images.length, 5);
    assert.deepEqual(input.images.map((image) => image.sortOrder), [0, 1, 2, 3, 4]);
});

test("advertisement input accepts seven images and rejects the eighth", () => {
    const base = {
        title: "Продам велосипед",
        settlement: "Станица Новая",
        description: "Исправное состояние",
    };
    const seven = Array.from({ length: 7 }, (_, index) => ({ url: `/uploads/${index}.jpg` }));
    assert.equal(validateAdvertisementInput({ ...base, images: seven }).images.length, 7);
    assert.throws(
        () => validateAdvertisementInput({ ...base, images: [...seven, { url: "/uploads/7.jpg" }] }),
        /не более 7 фотографий/
    );
});

test("seven-day group policy creates an exact expiry date", () => {
    const now = new Date("2026-08-16T10:00:00Z");
    assert.equal(
        advertisementExpiry({ now, lifetimeDays: 7 }).toISOString(),
        "2026-08-23T10:00:00.000Z",
    );
});

test("public category publishes immediately as a structured advertisement", async () => {
    const now = new Date("2026-08-16T10:00:00Z");
    const advertisement = await createAdvertisement({
        prisma: createPrisma(), actor, chatId: "group-4", source, now,
    });
    assert.equal(advertisement.status, "active");
    assert.equal(advertisement.title, "Продам велосипед");
    assert.equal(advertisement.expiresAt.toISOString(), "2026-08-23T10:00:00.000Z");
});

test("structured advertisement can be published without photographs", async () => {
    const advertisement = await createAdvertisement({
        prisma: createPrisma(),
        actor,
        chatId: "group-4",
        source: { ...source, images: [] },
    });
    assert.deepEqual(advertisement.images.create, []);
});

test("sixth open advertisement is rejected", async () => {
    await assert.rejects(
        createAdvertisement({
            prisma: createPrisma({ count: 5 }), actor, chatId: "group-4", source,
        }),
        (error) => error.code === "ADVERTISEMENT_LIMIT_REACHED",
    );
});

test("plain information group cannot receive an advertisement card", async () => {
    await assert.rejects(
        createAdvertisement({
            prisma: createPrisma({ ruleOverrides: { contentType: "notice" } }),
            actor,
            chatId: "group-1",
            source,
        }),
        (error) => error.code === "WRONG_GROUP_CONTENT_TYPE",
    );
});

test("expired advertisement is extended from today for another group period", async () => {
    let updateQuery;
    const prisma = {
        advertisement: {
            findUnique: async () => ({
                id: "ad-1",
                authorId: actor.id,
                status: "expired",
                expiresAt: new Date("2026-08-15T10:00:00Z"),
                groupRule: { advertisementLifetimeDays: 7 },
            }),
            update: async (query) => {
                updateQuery = query;
                return query.data;
            },
        },
    };
    await extendAdvertisement({
        prisma,
        actor,
        advertisementId: "ad-1",
        now: new Date("2026-08-16T10:00:00Z"),
    });
    assert.equal(updateQuery.data.status, "active");
    assert.equal(updateQuery.data.expiresAt.toISOString(), "2026-08-23T10:00:00.000Z");
});

test("moderator must explain why an advertisement needs editing", async () => {
    const prisma = { advertisement: { findUnique: async () => ({ id: "ad-1", status: "active" }) } };
    await assert.rejects(
        moderateAdvertisement({
            prisma,
            actor: { id: "moderator-1", role: "moderator" },
            advertisementId: "ad-1",
            status: "needs_edit",
            reason: "",
        }),
        (error) => error.field === "reason",
    );
});

test("moderator can finally remove an advertisement while preserving its row and audit", async () => {
    const calls = { update: null, audit: null };
    const prisma = {
        advertisement: {
            findUnique: async () => ({ id: "ad-1", status: "active" }),
        },
        $transaction: async (operation) => operation({
            advertisement: {
                update: async (query) => {
                    calls.update = query;
                    return { id: "ad-1", ...query.data };
                },
            },
            auditLog: {
                create: async (query) => { calls.audit = query; },
            },
        }),
    };

    const result = await moderateAdvertisement({
        prisma,
        actor: { id: "moderator-1", role: "moderator" },
        advertisementId: "ad-1",
        status: "removed",
        reason: "Повторное серьёзное нарушение правил",
        now: new Date("2026-08-17T10:00:00Z"),
    });

    assert.equal(result.status, "removed");
    assert.equal(calls.update.where.id, "ad-1");
    assert.equal(calls.audit.data.action, "advertisement.removed");
    assert.equal(calls.audit.data.details.previousStatus, "active");
});

test("moderator cannot use the author deletion status", async () => {
    await assert.rejects(
        moderateAdvertisement({
            prisma: {},
            actor: { id: "moderator-1", role: "moderator" },
            advertisementId: "ad-1",
            status: "deleted",
            reason: "Попытка физически скрыть запись",
        }),
        (error) => error.code === "INVALID_MODERATION_STATUS",
    );
});
