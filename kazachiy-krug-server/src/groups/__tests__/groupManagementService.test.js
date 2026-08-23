import assert from "node:assert/strict";
import test from "node:test";

import {
    changeGroupStatus,
    createManagedGroup,
    isVipGroup,
    listManagedGroups,
    setGroupMember,
    setGroupOwner,
    setGroupPublisher,
} from "../groupManagementService.js";

const admin = { id: "admin-1", name: "Казак", role: "admin", status: "active" };
const moderator = { id: "moderator-1", role: "moderator", status: "active" };

function transactionPrisma(overrides = {}) {
    const tx = {
        auditLog: { create: async () => ({}) },
        groupRule: {
            update: async ({ where, data }) => ({ chatId: where.chatId, ...data }),
        },
        chatMember: {
            upsert: async () => ({}),
            deleteMany: async () => ({ count: 1 }),
        },
        groupPublisher: {
            upsert: async () => ({}),
            deleteMany: async () => ({ count: 1 }),
        },
        ...overrides.tx,
    };
    return {
        $transaction: async (operation) => operation(tx),
        groupRule: { findUnique: async () => null, findMany: async () => [] },
        user: { findUnique: async () => null, findMany: async () => [] },
        chatMember: { findMany: async () => [] },
        ...overrides.prisma,
        _tx: tx,
    };
}

test("VIP group is private member chat with an administrative owner marker", () => {
    assert.equal(isVipGroup({ visibility: "private", publishPolicy: "members", ownerId: "admin-1" }), true);
    assert.equal(isVipGroup({ visibility: "private", publishPolicy: "members", ownerId: null }), false);
    assert.equal(isVipGroup({ visibility: "public", publishPolicy: "owner", ownerId: "user-1" }), false);
});

test("moderator does not receive VIP groups in management list", async () => {
    const base = {
        mode: "chat",
        contentType: "chat",
        status: "active",
        requiresAnnouncementWithImage: false,
        advertisementLifetimeDays: null,
        publishers: [],
        owner: null,
        ownershipStartsAt: null,
        ownershipEndsAt: null,
        chat: { title: "Группа", createdAt: new Date() },
    };
    const prisma = transactionPrisma({
        prisma: {
            groupRule: {
                findMany: async () => [
                    { ...base, chatId: "group-010", visibility: "private", publishPolicy: "members", ownerId: null },
                    { ...base, chatId: "group-vip", visibility: "private", publishPolicy: "members", ownerId: "admin-1" },
                ],
            },
        },
    });

    const groups = await listManagedGroups({ prisma, actor: moderator });
    assert.deepEqual(groups.map((group) => group.chatId), ["group-010"]);
});

test("numbered groups use natural numeric order instead of text order", async () => {
    const base = {
        mode: "chat",
        contentType: "chat",
        visibility: "public",
        publishPolicy: "members",
        status: "active",
        requiresAnnouncementWithImage: false,
        advertisementLifetimeDays: null,
        ownerId: null,
        owner: null,
        publishers: [],
        ownershipStartsAt: null,
        ownershipEndsAt: null,
        chat: { title: "Группа", createdAt: new Date() },
    };
    const prisma = transactionPrisma({
        prisma: {
            groupRule: {
                findMany: async () => [
                    { ...base, chatId: "group-1" },
                    { ...base, chatId: "group-10" },
                    { ...base, chatId: "group-2" },
                ],
            },
        },
    });

    const groups = await listManagedGroups({ prisma, actor: admin });
    assert.deepEqual(groups.map((group) => group.chatId), ["group-1", "group-2", "group-10"]);
});

test("moderator cannot change VIP group status", async () => {
    const prisma = transactionPrisma({
        prisma: {
            groupRule: {
                findUnique: async () => ({
                    chatId: "group-vip",
                    visibility: "private",
                    publishPolicy: "members",
                    ownerId: "admin-1",
                    status: "active",
                }),
            },
        },
    });

    await assert.rejects(
        changeGroupStatus({ prisma, actor: moderator, chatId: "group-vip", status: "archived", reason: "Проверка" }),
        (error) => error.code === "VIP_ADMIN_ONLY" && error.statusCode === 403,
    );
});

test("disabling a group requires a reason and writes an audit entry", async () => {
    const audit = [];
    const prisma = transactionPrisma({
        prisma: {
            groupRule: {
                findUnique: async () => ({ chatId: "group-1", visibility: "public", publishPolicy: "members", status: "active" }),
            },
        },
        tx: { auditLog: { create: async ({ data }) => audit.push(data) } },
    });

    await assert.rejects(
        changeGroupStatus({ prisma, actor: moderator, chatId: "group-1", status: "disabled", reason: "" }),
        (error) => error.field === "reason",
    );
    await changeGroupStatus({ prisma, actor: moderator, chatId: "group-1", status: "disabled", reason: "Нарушение правил" });
    assert.equal(audit[0].action, "group.status");
    assert.equal(audit[0].details.reason, "Нарушение правил");
});

test("private group membership can be granted by moderator", async () => {
    let assigned = null;
    const prisma = transactionPrisma({
        prisma: {
            groupRule: { findUnique: async () => ({ chatId: "group-13", visibility: "private", publishPolicy: "members", ownerId: null }) },
            user: { findUnique: async () => ({ id: "user-2", role: "user", status: "active" }) },
        },
        tx: {
            chatMember: { upsert: async ({ create }) => { assigned = create; } },
        },
    });

    await setGroupMember({ prisma, actor: moderator, chatId: "group-13", userId: "user-2", assigned: true });
    assert.deepEqual(assigned, { chatId: "group-13", userId: "user-2" });
});

test("administrator cannot be removed from a private group", async () => {
    const prisma = transactionPrisma({
        prisma: {
            groupRule: { findUnique: async () => ({ chatId: "group-13", visibility: "private", publishPolicy: "members", ownerId: null }) },
            user: { findUnique: async () => ({ id: "admin-1", role: "admin", status: "active" }) },
        },
    });
    await assert.rejects(
        setGroupMember({ prisma, actor: admin, chatId: "group-13", userId: "admin-1", assigned: false }),
        (error) => error.code === "ADMIN_MEMBERSHIP_PROTECTED",
    );
});

test("selected authors cannot be assigned to an ordinary member-policy group", async () => {
    const prisma = transactionPrisma({
        prisma: {
            groupRule: { findUnique: async () => ({ chatId: "group-12", visibility: "public", publishPolicy: "members", ownerId: null }) },
            user: { findUnique: async () => ({ id: "user-2", role: "user", status: "active" }) },
        },
    });
    await assert.rejects(
        setGroupPublisher({ prisma, actor: moderator, chatId: "group-12", userId: "user-2", assigned: true }),
        (error) => error.code === "GROUP_NOT_SELECTED_AUTHORS",
    );
});

test("only administrator can set a paid group owner and period", async () => {
    const prisma = transactionPrisma({
        prisma: {
            groupRule: { findUnique: async () => ({ chatId: "group-paid", visibility: "public", publishPolicy: "owner", ownerId: null }) },
            user: { findUnique: async () => ({ id: "user-2", role: "user", status: "active" }) },
        },
    });
    await assert.rejects(
        setGroupOwner({
            prisma,
            actor: moderator,
            chatId: "group-paid",
            source: { userId: "user-2", ownershipStartsAt: "2026-08-01", ownershipEndsAt: "2026-09-01" },
        }),
        (error) => error.code === "FORBIDDEN",
    );
});

test("VIP template creates administrator membership and keeps the marker", async () => {
    let createdRule = null;
    let member = null;
    const fullRule = (data) => ({
        ...data,
        status: "active",
        chat: { title: "Закрытый круг", createdAt: new Date() },
        owner: null,
        publishers: [],
        ownershipStartsAt: null,
        ownershipEndsAt: null,
    });
    const prisma = transactionPrisma({
        tx: {
            chat: { create: async () => ({}) },
            chatMember: { create: async ({ data }) => { member = data; } },
            groupRule: {
                create: async ({ data }) => {
                    createdRule = data;
                    return fullRule(data);
                },
            },
        },
    });
    const result = await createManagedGroup({
        prisma,
        actor: admin,
        source: { title: "Закрытый круг", template: "vip" },
    });
    assert.equal(createdRule.ownerId, admin.id);
    assert.equal(member.userId, admin.id);
    assert.equal(result.isVip, true);
});
