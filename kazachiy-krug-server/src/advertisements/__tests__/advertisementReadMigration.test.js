import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("advertisement read migration stores one timestamp per user and group", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const sql = fs.readFileSync(path.resolve(
        here,
        "../../../prisma/migrations/20260821100000_add_advertisement_group_read_state/migration.sql"
    ), "utf8");
    assert.match(sql, /CREATE TABLE "advertisement_group_reads"/);
    assert.match(sql, /PRIMARY KEY \("userId", "chatId"\)/);
    assert.match(sql, /ON DELETE CASCADE/);
});
