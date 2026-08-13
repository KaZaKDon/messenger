import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../password.js";

test("password hashes are salted and verifiable", async () => {
    const first = await hashPassword("correct horse battery staple");
    const second = await hashPassword("correct horse battery staple");

    assert.notEqual(first, second);
    assert.equal(await verifyPassword("correct horse battery staple", first), true);
    assert.equal(await verifyPassword("wrong password", first), false);
});

test("invalid password hashes fail closed", async () => {
    assert.equal(await verifyPassword("password", "invalid"), false);
});