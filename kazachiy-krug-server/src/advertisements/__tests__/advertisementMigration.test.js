import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
    "../../../prisma/migrations/20260817160000_expand_advertisement_images_to_seven/migration.sql",
    import.meta.url,
);

test("database constraint accepts advertisement image positions from zero through six", async () => {
    const sql = await readFile(migrationUrl, "utf8");

    assert.match(sql, /DROP CONSTRAINT IF EXISTS "advertisement_images_sort_order_check"/);
    assert.match(sql, /CHECK \("sortOrder" BETWEEN 0 AND 6\)/);
});
