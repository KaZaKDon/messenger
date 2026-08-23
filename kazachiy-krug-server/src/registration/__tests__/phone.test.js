import assert from "node:assert/strict";
import test from "node:test";

import {
    formatRussianMobilePhone,
    isRussianMobilePhone,
    normalizeRussianMobilePhone,
} from "../phone.js";

test("Russian mobile phone accepts familiar input formats", () => {
    for (const input of [
        "+7 (951) 123-45-67",
        "+79511234567",
        "79511234567",
        "89511234567",
        "9511234567",
    ]) {
        assert.equal(normalizeRussianMobilePhone(input), "+79511234567");
    }
});

test("Russian mobile phone has a familiar display format", () => {
    assert.equal(formatRussianMobilePhone("+7 951 123-45-67"), "8 (951) 123-45-67");
    assert.equal(formatRussianMobilePhone("invalid"), null);
});

test("Russian mobile phone rejects landlines, foreign numbers and malformed input", () => {
    for (const input of [
        "+7 (863) 123-45-67",
        "+31 6 12345678",
        "+7 phone 9511234567",
        "+7951123456",
        "",
        null,
    ]) {
        assert.equal(normalizeRussianMobilePhone(input), null);
        assert.equal(isRussianMobilePhone(input), false);
    }
});
