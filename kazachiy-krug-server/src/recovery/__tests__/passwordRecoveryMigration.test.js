import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
    "../../../prisma/migrations/20260822190000_complete_password_recovery/migration.sql",
    import.meta.url,
);

test("password recovery migration binds new requests to a browser and expires legacy rows", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    assert.match(sql, /"clientSecretHash" TEXT/);
    assert.match(sql, /"status" TEXT NOT NULL DEFAULT 'pending'/);
    assert.match(sql, /SET "status" = 'expired'/);
    assert.match(sql, /DROP INDEX IF EXISTS "password_recovery_requests_requestCode_key"/);
});
