import assert from "node:assert/strict";
import test from "node:test";

import {
    getAdvertisementGroupSummaries,
    markAdvertisementGroupRead,
} from "../advertisementReadService.js";

function activeActor(overrides = {}) {
    return { id: "user-1", status: "active", role: "user", ...overrides };
}

test("advertisement summaries count only unread publications by other authors", async () => {
    const lastReadAt = new Date("2026-08-21T10:00:00.000Z");
    const prisma = {
        advertisement: { updateMany: async () => ({ count: 0 }) },
        groupRule: {
            findMany: async () => [{
                chatId: "group-4",
                advertisements: [
                    { authorId: "user-2", title: "Новое", publishedAt: new Date("2026-08-21T11:00:00.000Z") },
                    { authorId: "user-1", title: "Моё", publishedAt: new Date("2026-08-21T10:30:00.000Z") },
                    { authorId: "user-3", title: "Прочитано", publishedAt: new Date("2026-08-21T09:00:00.000Z") },
                ],
            }],
        },
        advertisementGroupRead: {
            findMany: async () => [{ chatId: "group-4", lastReadAt }],
        },
    };

    const [summary] = await getAdvertisementGroupSummaries({ prisma, actor: activeActor() });
    assert.deepEqual(summary, {
        chatId: "group-4",
        total: 3,
        unread: 1,
        latestTitle: "Новое",
        latestPublishedAt: new Date("2026-08-21T11:00:00.000Z"),
    });
});

test("first visit treats every active foreign advertisement as unread", async () => {
    const prisma = {
        advertisement: { updateMany: async () => ({ count: 0 }) },
        groupRule: {
            findMany: async () => [{
                chatId: "group-5",
                advertisements: [
                    { authorId: "user-2", title: "Первое", publishedAt: new Date() },
                    { authorId: "user-3", title: "Второе", publishedAt: new Date() },
                ],
            }],
        },
        advertisementGroupRead: { findMany: async () => [] },
    };
    const [summary] = await getAdvertisementGroupSummaries({ prisma, actor: activeActor() });
    assert.equal(summary.unread, 2);
});

test("empty advertisement groups remain present in the menu summaries", async () => {
    const prisma = {
        advertisement: { updateMany: async () => ({ count: 0 }) },
        groupRule: { findMany: async () => [{ chatId: "group-2", advertisements: [] }] },
        advertisementGroupRead: { findMany: async () => [] },
    };
    const [summary] = await getAdvertisementGroupSummaries({ prisma, actor: activeActor() });
    assert.equal(summary.total, 0);
    assert.equal(summary.latestTitle, null);
});

test("opening an advertisement group persists its read timestamp", async () => {
    const now = new Date("2026-08-21T12:00:00.000Z");
    let upsert = null;
    const prisma = {
        groupRule: { findFirst: async () => ({ chatId: "group-4" }) },
        advertisementGroupRead: {
            upsert: async (query) => {
                upsert = query;
                return query.create;
            },
        },
    };
    await markAdvertisementGroupRead({ prisma, actor: activeActor(), chatId: "group-4", now });
    assert.deepEqual(upsert.where, {
        userId_chatId: { userId: "user-1", chatId: "group-4" },
    });
    assert.equal(upsert.update.lastReadAt, now);
});
