import test from "node:test";
import assert from "node:assert/strict";

import { recordGroupPayment, voidGroupPayment } from "../groupPaymentService.js";

const admin = { id: "admin-1", role: "admin" };
const source = {
    chatId: "paid-group-1",
    ownerId: "user-2",
    amount: "1500,50",
    paidAt: "2026-08-16T10:00:00Z",
    periodStartsAt: "2026-08-16T00:00:00Z",
    periodEndsAt: "2026-09-16T00:00:00Z",
    comment: "Оплата по договору",
};

test("administrator records a ruble payment and its audit entry", async () => {
    const calls = { payments: [], audits: [] };
    const tx = {
        groupPayment: {
            create: async (query) => {
                calls.payments.push(query);
                return { id: "pay-1", ...query.data };
            },
        },
        auditLog: { create: async (query) => calls.audits.push(query) },
    };
    const prisma = {
        groupRule: { findUnique: async () => ({ chatId: source.chatId, ownerId: source.ownerId }) },
        user: { findUnique: async () => ({ id: source.ownerId, status: "active" }) },
        $transaction: async (callback) => callback(tx),
    };
    const payment = await recordGroupPayment({ prisma, actor: admin, source });
    assert.equal(payment.amount, "1500.50");
    assert.equal(payment.currency, "RUB");
    assert.equal(calls.audits[0].data.action, "group_payment.record");
});

test("payment period cannot end before it starts", async () => {
    await assert.rejects(
        recordGroupPayment({
            prisma: {},
            actor: admin,
            source: { ...source, periodEndsAt: "2026-08-15T00:00:00Z" },
        }),
        (error) => error.code === "INVALID_PAYMENT_PERIOD",
    );
});

test("payment is voided instead of being physically deleted", async () => {
    const calls = { updates: [], audits: [] };
    const tx = {
        groupPayment: {
            update: async (query) => {
                calls.updates.push(query);
                return query.data;
            },
        },
        auditLog: { create: async (query) => calls.audits.push(query) },
    };
    const prisma = {
        groupPayment: { findUnique: async () => ({ id: "pay-1", status: "recorded" }) },
        $transaction: async (callback) => callback(tx),
    };
    const payment = await voidGroupPayment({
        prisma,
        actor: admin,
        paymentId: "pay-1",
        reason: "Исправление ошибочной записи",
    });
    assert.equal(payment.status, "voided");
    assert.equal(calls.audits[0].data.action, "group_payment.void");
});
