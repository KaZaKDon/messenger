import test from "node:test";
import assert from "node:assert/strict";
import { blockUser, isPrivateContactUnavailable, listBlockedUsers, unblockUser } from "../userBlockService.js";

test("personal blacklist is directional for storage and mutual for communication", async () => {
    const rows = [{ blockerId: "user-1", blockedId: "user-2", createdAt: new Date("2026-08-22T12:00:00Z") }];
    const users = { "user-2": { id: "user-2", name: "Второй", phone: "+79990000002", avatar: null } };
    const db = {
        user: { findFirst: async ({ where }) => users[where.id] ?? null },
        userBlock: {
            upsert: async () => ({ createdAt: rows[0].createdAt }),
            findFirst: async ({ where }) => rows.find((row) => where.OR.some((item) => item.blockerId === row.blockerId && item.blockedId === row.blockedId)) ?? null,
            findMany: async () => rows.map((row) => ({ createdAt: row.createdAt, blocked: users[row.blockedId] })),
            deleteMany: async () => ({ count: 1 }),
        },
    };
    assert.equal((await blockUser(db, "user-1", "user-2")).id, "user-2");
    assert.equal(await isPrivateContactUnavailable(db, "user-2", "user-1"), true);
    assert.equal((await listBlockedUsers(db, "user-1"))[0].id, "user-2");
    await assert.doesNotReject(() => unblockUser(db, "user-1", "user-2"));
});

test("user cannot add self to personal blacklist", async () => {
    await assert.rejects(() => blockUser({}, "user-1", "user-1"), /самого себя/);
});
