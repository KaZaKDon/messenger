import assert from "node:assert/strict";
import test from "node:test";

import {
    clearRecoveryCredential,
    effectiveRecoveryStatus,
    readRecoveryCredential,
    recoveryCredential,
    saveRecoveryCredential,
} from "../passwordRecoveryModel.js";

function memoryStorage() {
    const values = new Map();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
    };
}

test("password recovery browser credential survives reopening the form", () => {
    const storage = memoryStorage();
    const value = { recoveryId: "request-1", browserSecret: "secret", requestCode: "1234", status: "pending" };
    assert.equal(saveRecoveryCredential(value, storage), true);
    assert.deepEqual(readRecoveryCredential(storage), value);
    assert.deepEqual(recoveryCredential(value), { recoveryId: "request-1", browserSecret: "secret" });
    clearRecoveryCredential(storage);
    assert.equal(readRecoveryCredential(storage), null);
});

test("an expired local recovery request stops waiting even for a generic server response", () => {
    assert.equal(effectiveRecoveryStatus({ status: "pending", expiresAt: "2026-08-22T10:00:00.000Z" }, Date.parse("2026-08-22T10:00:01.000Z")), "expired");
    assert.equal(effectiveRecoveryStatus({ status: "approved", expiresAt: "2026-08-22T10:00:02.000Z" }, Date.parse("2026-08-22T10:00:01.000Z")), "approved");
});

test("invalid password recovery state fails safely", () => {
    const storage = memoryStorage();
    storage.setItem("passwordRecovery", "{bad json");
    assert.equal(readRecoveryCredential(storage), null);
    assert.equal(saveRecoveryCredential({ requestCode: "12" }, storage), false);
});
