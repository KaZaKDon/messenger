import assert from "node:assert/strict";
import test from "node:test";

import {
    buildRegistrationExpiry,
    REGISTRATION_APPLICATION_TTL_MS,
    RegistrationValidationError,
    validateRegistrationApplicationInput,
} from "../applicationValidation.js";

const VALID_INPUT = {
    nickname: "Донской казак",
    phone: "8 (951) 123-45-67",
    email: " User@Example.com ",
    password: "strong-password",
    passwordConfirmation: "strong-password",
    firstName: "Иван",
    lastName: "Петров",
    settlement: "станица Вёшенская",
    occupation: "Пчеловод",
    purposes: ["community", "publish_announcements"],
    purposeNote: "",
    acceptances: {
        termsRules: true,
        personalData: true,
        publicProfile: true,
    },
};

test("registration input normalizes account and private application fields", () => {
    assert.deepEqual(validateRegistrationApplicationInput(VALID_INPUT), {
        nickname: "Донской казак",
        phone: "+79511234567",
        email: "user@example.com",
        password: "strong-password",
        firstName: "Иван",
        lastName: "Петров",
        settlement: "станица Вёшенская",
        occupation: "Пчеловод",
        purposes: ["community", "publish_announcements"],
        purposeNote: null,
        acceptances: {
            termsRules: true,
            personalData: true,
            publicProfile: true,
        },
    });
});

test("registration email is optional", () => {
    const result = validateRegistrationApplicationInput({ ...VALID_INPUT, email: "" });
    assert.equal(result.email, null);
});

test("registration requires Russian mobile phone and matching passwords", () => {
    assert.throws(
        () => validateRegistrationApplicationInput({ ...VALID_INPUT, phone: "+31 6 12345678" }),
        (error) => error instanceof RegistrationValidationError && error.field === "phone",
    );
    assert.throws(
        () => validateRegistrationApplicationInput({ ...VALID_INPUT, passwordConfirmation: "different" }),
        (error) => error instanceof RegistrationValidationError && error.field === "passwordConfirmation",
    );
});

test("registration requires private application fields and a purpose", () => {
    assert.throws(
        () => validateRegistrationApplicationInput({ ...VALID_INPUT, occupation: "" }),
        (error) => error instanceof RegistrationValidationError && error.field === "occupation",
    );
    assert.throws(
        () => validateRegistrationApplicationInput({ ...VALID_INPUT, purposes: [] }),
        (error) => error instanceof RegistrationValidationError && error.field === "purposes",
    );
});

test("other registration purpose requires a short explanation", () => {
    assert.throws(
        () => validateRegistrationApplicationInput({ ...VALID_INPUT, purposes: ["other"] }),
        (error) => error instanceof RegistrationValidationError && error.field === "purposeNote",
    );
});

test("registration requires all three separate acceptances", () => {
    assert.throws(
        () => validateRegistrationApplicationInput({
            ...VALID_INPUT,
            acceptances: { ...VALID_INPUT.acceptances, publicProfile: false },
        }),
        (error) => error instanceof RegistrationValidationError
            && error.field === "acceptances.publicProfile",
    );
});

test("registration application expires after exactly three days", () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    const expiresAt = buildRegistrationExpiry(now);

    assert.equal(expiresAt.getTime() - now.getTime(), REGISTRATION_APPLICATION_TTL_MS);
    assert.equal(expiresAt.toISOString(), "2026-08-18T12:00:00.000Z");
});
