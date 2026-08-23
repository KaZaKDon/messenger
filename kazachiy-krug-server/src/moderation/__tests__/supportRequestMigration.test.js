import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
    "../../../prisma/migrations/20260820200000_add_support_request_read_state/migration.sql",
    import.meta.url,
);

test("support request migration adds category and author read state", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    assert.match(sql, /"category" TEXT NOT NULL DEFAULT 'other'/);
    assert.match(sql, /"authorLastReadAt" TIMESTAMP\(3\)/);
    assert.match(sql, /"lastStaffMessageAt" TIMESTAMP\(3\)/);
});
