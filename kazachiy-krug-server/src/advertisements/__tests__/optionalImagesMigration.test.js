import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("optional image migration updates every advertisement group", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const sql = fs.readFileSync(path.resolve(
        here,
        "../../../prisma/migrations/20260821170000_make_advertisement_images_optional/migration.sql"
    ), "utf8");
    assert.match(sql, /SET "requiresAnnouncementWithImage" = false/);
    assert.match(sql, /WHERE "contentType" = 'advertisement'/);
});
