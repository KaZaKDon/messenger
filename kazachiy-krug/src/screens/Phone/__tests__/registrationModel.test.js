import assert from "node:assert/strict";
import test from "node:test";

import {
    createEmptyRegistration,
    formatRussianPhoneInput,
    isAccountStepValid,
} from "../registrationModel.js";

test("Russian mobile phone input has one stable display format", () => {
    assert.equal(formatRussianPhoneInput("89381532981"), "+7 (938) 153-29-81");
    assert.equal(formatRussianPhoneInput("+7 938 153 29 81"), "+7 (938) 153-29-81");
});

test("Russian mobile phone formatter supports gradual input", () => {
    assert.equal(formatRussianPhoneInput("9"), "+7 (9");
    assert.equal(formatRussianPhoneInput("9381"), "+7 (938) 1");
    assert.equal(formatRussianPhoneInput(""), "");
});

test("account step requires matching passwords", () => {
    const application = createEmptyRegistration();
    Object.assign(application, {
        nickname: "Казак",
        phone: "+7 (938) 153-29-81",
        password: "Password-2026",
        passwordConfirmation: "Another-password",
    });

    assert.equal(isAccountStepValid(application), "Пароли не совпадают");
});

test("valid account step has no validation error", () => {
    const application = createEmptyRegistration();
    Object.assign(application, {
        nickname: "Казак",
        phone: "+7 (938) 153-29-81",
        password: "Password-2026",
        passwordConfirmation: "Password-2026",
    });

    assert.equal(isAccountStepValid(application), "");
});

test("new registration forms do not share arrays and acceptances", () => {
    const first = createEmptyRegistration();
    const second = createEmptyRegistration();
    first.purposes.push("community");
    first.acceptances.termsRules = true;

    assert.deepEqual(second.purposes, []);
    assert.equal(second.acceptances.termsRules, false);
});
