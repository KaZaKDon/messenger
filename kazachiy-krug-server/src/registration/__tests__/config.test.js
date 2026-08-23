import assert from "node:assert/strict";
import test from "node:test";

import {
    readRegistrationConfig,
    RegistrationConfigError,
} from "../config.js";

test("registration config normalizes and formats the administrator contact", () => {
    const config = readRegistrationConfig({
        REGISTRATION_CONTACT_PHONE: "8 (951) 123-45-67",
        REGISTRATION_TERMS_RULES_VERSION: "rules-v2",
    });

    assert.equal(config.contactPhone, "+79511234567");
    assert.equal(config.contactPhoneDisplay, "8 (951) 123-45-67");
    assert.equal(config.documentVersions.terms_rules, "rules-v2");
    assert.ok(config.documentVersions.personal_data);
    assert.ok(config.documentVersions.public_profile);
});

test("registration config requires a Russian mobile contact", () => {
    assert.throws(
        () => readRegistrationConfig({ REGISTRATION_CONTACT_PHONE: "+31 6 12345678" }),
        RegistrationConfigError,
    );
});
