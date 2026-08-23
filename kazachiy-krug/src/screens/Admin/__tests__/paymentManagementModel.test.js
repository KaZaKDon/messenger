import test from "node:test";
import assert from "node:assert/strict";

import { effectivePaymentState, filterPayments, paymentCounters, validPaymentDraft } from "../paymentManagementModel.js";

const now = new Date("2026-08-20T12:00:00Z");
const payments = [
    { id: "active", status: "recorded", periodStartsAt: "2026-08-01", periodEndsAt: "2026-09-20" },
    { id: "soon", status: "recorded", periodStartsAt: "2026-08-01", periodEndsAt: "2026-08-23" },
    { id: "old", status: "recorded", periodStartsAt: "2026-07-01", periodEndsAt: "2026-08-01" },
    { id: "void", status: "voided", periodStartsAt: "2026-08-01", periodEndsAt: "2026-09-01" },
];

test("payment state reflects period and soft cancellation", () => {
    assert.equal(effectivePaymentState(payments[0], now), "active");
    assert.equal(effectivePaymentState(payments[1], now), "expiring");
    assert.equal(effectivePaymentState(payments[2], now), "expired");
    assert.equal(effectivePaymentState(payments[3], now), "voided");
});

test("payment counters preserve every journal record", () => {
    assert.deepEqual(paymentCounters(payments, now), { total: 4, active: 1, expiring: 1, expired: 1, voided: 1, upcoming: 0 });
});

test("payment search covers group, owner, phone and comment", () => {
    const rows = [{ ...payments[0], groupRule: { chat: { title: "Мастерская" } }, owner: { name: "Иван", phone: "+7999" }, comment: "Договор" }];
    assert.equal(filterPayments(rows, { query: "мастер" }, now).length, 1);
    assert.equal(filterPayments(rows, { query: "+7999" }, now).length, 1);
    assert.equal(filterPayments(rows, { query: "музей" }, now).length, 0);
});

test("payment draft requires owner, amount and a valid period", () => {
    const draft = { chatId: "group-paid", ownerId: "user-1", amount: "1500,50", paidAt: "2026-08-20T12:00", periodStartsAt: "2026-08-20", periodEndsAt: "2026-09-20" };
    assert.equal(validPaymentDraft(draft), true);
    assert.equal(validPaymentDraft({ ...draft, ownerId: "" }), false);
    assert.equal(validPaymentDraft({ ...draft, periodEndsAt: "2026-08-19" }), false);
});
