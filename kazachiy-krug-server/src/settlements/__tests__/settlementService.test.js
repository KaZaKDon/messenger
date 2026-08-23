import test from "node:test";
import assert from "node:assert/strict";
import {
    assertActiveSettlement,
    createSettlement,
    normalizeSettlementName,
    updateSettlement,
} from "../settlementService.js";

const admin = { id: "admin-1", role: "admin" };
const moderator = { id: "moderator-1", role: "moderator" };

test("settlement name collapses spaces", () => {
    assert.equal(normalizeSettlementName("  станица   Вёшенская "), "станица Вёшенская");
});

test("only administrator can create settlements", async () => {
    await assert.rejects(
        createSettlement({ prisma: {}, actor: moderator, name: "Вёшенская" }),
        (error) => error.code === "FORBIDDEN",
    );
});

test("duplicate settlement is rejected case-insensitively", async () => {
    const prisma = { settlement: { findUnique: async () => ({ id: "s1" }) } };
    await assert.rejects(
        createSettlement({ prisma, actor: admin, name: "ВЁШЕНСКАЯ" }),
        (error) => error.code === "SETTLEMENT_DUPLICATE",
    );
});

test("inactive settlement cannot be used in advertisement", async () => {
    const prisma = { settlement: { findUnique: async () => ({ id: "s1", isActive: false }) } };
    await assert.rejects(
        assertActiveSettlement({ prisma, name: "Вёшенская" }),
        (error) => error.code === "SETTLEMENT_UNAVAILABLE",
    );
});

test("administrator can disable settlement without deleting it", async () => {
    const prisma = { settlement: {
        findUnique: async () => ({ id: "s1", name: "Вёшенская", isActive: true }),
        update: async ({ data }) => ({ id: "s1", name: "Вёшенская", ...data }),
    } };
    const result = await updateSettlement({ prisma, actor: admin, settlementId: "s1", source: { isActive: false } });
    assert.equal(result.isActive, false);
});
