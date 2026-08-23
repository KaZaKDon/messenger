import test from "node:test";
import assert from "node:assert/strict";

import { createComplaint, reviewComplaint } from "../complaintService.js";
import {
    answerSupportRequest,
    createSupportRequest,
    markSupportRequestRead,
    startSupportRequest,
} from "../supportRequestService.js";

const user = { id: "user-1", role: "user", status: "active" };
const moderator = { id: "moderator-1", role: "moderator", status: "active" };

test("complaint stores a snapshot of the reported advertisement", async () => {
    let createQuery;
    const prisma = {
        advertisement: {
            findUnique: async () => ({
                id: "ad-1", title: "Продам", authorId: "user-2", status: "active",
            }),
        },
        complaint: {
            findFirst: async () => null,
            create: async (query) => {
                createQuery = query;
                return query.data;
            },
        },
    };
    await createComplaint({
        prisma,
        actor: user,
        source: {
            targetType: "advertisement",
            targetId: "ad-1",
            reason: "Неверная информация",
            details: "Описание не соответствует фотографии",
        },
    });
    assert.equal(createQuery.data.status, "new");
    assert.equal(createQuery.data.targetSnapshot.title, "Продам");
});

test("user cannot complain about own advertisement", async () => {
    const prisma = {
        advertisement: {
            findUnique: async () => ({
                id: "ad-1", title: "Продам", authorId: user.id, status: "active", images: [],
            }),
        },
    };
    await assert.rejects(
        createComplaint({
            prisma,
            actor: user,
            source: { targetType: "advertisement", targetId: "ad-1", reason: "Причина" },
        }),
        (error) => error.code === "SELF_COMPLAINT",
    );
});

test("duplicate open complaint from the same reporter is rejected", async () => {
    const prisma = {
        advertisement: {
            findUnique: async () => ({
                id: "ad-1", title: "Продам", authorId: "user-2", status: "active", images: [],
            }),
        },
        complaint: { findFirst: async () => ({ id: "complaint-1" }) },
    };
    await assert.rejects(
        createComplaint({
            prisma,
            actor: user,
            source: { targetType: "advertisement", targetId: "ad-1", reason: "Причина" },
        }),
        (error) => error.code === "COMPLAINT_ALREADY_OPEN",
    );
});

test("closed complaint requires a moderation resolution", async () => {
    const prisma = { complaint: { findUnique: async () => ({ id: "c-1", status: "new" }) } };
    await assert.rejects(
        reviewComplaint({
            prisma,
            actor: moderator,
            complaintId: "c-1",
            status: "resolved",
            resolution: "",
        }),
        (error) => error.field === "resolution",
    );
});

test("resolved complaint can send its advertisement to revision atomically", async () => {
    const calls = { advertisement: null, complaint: null, audits: [] };
    const tx = {
        advertisement: {
            findUnique: async () => ({ id: "ad-1", status: "active" }),
            update: async (query) => { calls.advertisement = query; },
        },
        complaint: {
            update: async (query) => {
                calls.complaint = query;
                return query.data;
            },
        },
        auditLog: { create: async (query) => calls.audits.push(query) },
    };
    const prisma = {
        complaint: {
            findUnique: async () => ({
                id: "c-1", status: "in_review", targetType: "advertisement", targetId: "ad-1",
            }),
        },
        $transaction: async (callback) => callback(tx),
    };
    await reviewComplaint({
        prisma,
        actor: moderator,
        complaintId: "c-1",
        status: "resolved",
        resolution: "Нарушение подтверждено",
        advertisementAction: "needs_edit",
        actionReason: "Фотография не соответствует описанию",
    });
    assert.equal(calls.advertisement.data.status, "needs_edit");
    assert.equal(calls.complaint.data.status, "resolved");
    assert.equal(calls.audits[0].data.details.complaintId, "c-1");
    assert.equal(calls.audits[1].data.action, "complaint.resolved");
});

test("support request is created with its first message", async () => {
    let createQuery;
    const prisma = {
        supportRequest: {
            create: async (query) => {
                createQuery = query;
                return query.data;
            },
        },
    };
    await createSupportRequest({
        prisma,
        actor: user,
        source: { category: "question", subject: "Вопрос по группе", text: "Как получить доступ в группу 010?" },
    });
    assert.equal(createQuery.data.status, "new");
    assert.equal(createQuery.data.category, "question");
    assert.ok(createQuery.data.authorLastReadAt instanceof Date);
    assert.equal(createQuery.data.messages.create.authorId, user.id);
});

test("moderator answer becomes part of the support request thread", async () => {
    const calls = { messages: [], updates: [], audits: [] };
    const tx = {
        supportRequestMessage: { create: async (query) => calls.messages.push(query) },
        supportRequest: {
            update: async (query) => {
                calls.updates.push(query);
                return query.data;
            },
        },
        auditLog: { create: async (query) => calls.audits.push(query) },
    };
    const prisma = {
        supportRequest: { findUnique: async () => ({ id: "r-1", status: "new" }) },
        $transaction: async (callback) => callback(tx),
    };
    await answerSupportRequest({
        prisma,
        actor: moderator,
        requestId: "r-1",
        text: "Доступ выдаётся после проверки администратором.",
    });
    assert.equal(calls.messages[0].data.authorId, moderator.id);
    assert.equal(calls.updates[0].data.status, "answered");
    assert.ok(calls.updates[0].data.lastStaffMessageAt instanceof Date);
    assert.equal(calls.audits[0].data.action, "support_request.answer");
});

test("moderator takes a support request into work", async () => {
    const calls = { update: null, audit: null };
    const prisma = {
        supportRequest: { findUnique: async () => ({ id: "r-1", status: "new" }) },
        $transaction: async (callback) => callback({
            supportRequest: { update: async (query) => { calls.update = query; return query.data; } },
            auditLog: { create: async (query) => { calls.audit = query; } },
        }),
    };
    await startSupportRequest({ prisma, actor: moderator, requestId: "r-1" });
    assert.equal(calls.update.data.status, "in_progress");
    assert.equal(calls.update.data.assignedToId, moderator.id);
    assert.equal(calls.audit.data.action, "support_request.start");
});

test("support request author can mark an answer as read", async () => {
    let updateQuery;
    const prisma = {
        supportRequest: {
            findUnique: async () => ({ id: "r-1", authorId: user.id }),
            update: async (query) => { updateQuery = query; return query.data; },
        },
    };
    await markSupportRequestRead({
        prisma,
        actor: user,
        requestId: "r-1",
        now: new Date("2026-08-20T18:00:00Z"),
    });
    assert.equal(updateQuery.data.authorLastReadAt.toISOString(), "2026-08-20T18:00:00.000Z");
});
