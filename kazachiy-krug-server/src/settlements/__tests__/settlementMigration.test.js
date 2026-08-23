import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
    "../../../prisma/migrations/20260817190000_add_settlement_directory/migration.sql",
    import.meta.url,
);

test("settlement migration creates directory and imports existing advertisement values", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    assert.match(sql, /CREATE TABLE "public"\."settlements"/);
    assert.match(sql, /CREATE UNIQUE INDEX "settlements_normalizedName_key"/);
    assert.match(sql, /FROM "public"\."advertisements"/);
    assert.match(sql, /ON CONFLICT \("normalizedName"\) DO NOTHING/);
});
