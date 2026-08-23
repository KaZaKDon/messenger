import assert from "node:assert/strict";
import test from "node:test";

import { withStaffPrivateProfile } from "../staffUserProfile.js";

test("staff profile exposes only agreed identity and registration purpose fields", () => {
    const result = withStaffPrivateProfile({
        id: "user-1",
        name: "Пчеловод",
        profile: { settlement: "ст. Вёшенская", occupation: "Пчеловод" },
        registrationApplication: {
            firstName: "Иван",
            lastName: "Петров",
            settlement: "старое значение",
            occupation: "старое занятие",
            purposes: ["community"],
            purposeNote: "Общение",
            approvalCode: "3345",
        },
    });

    assert.deepEqual(result.privateProfile, {
        firstName: "Иван",
        lastName: "Петров",
        settlement: "ст. Вёшенская",
        occupation: "Пчеловод",
        purposes: ["community"],
        purposeNote: "Общение",
    });
    assert.equal("profile" in result, false);
    assert.equal("registrationApplication" in result, false);
    assert.equal(JSON.stringify(result).includes("3345"), false);
});

test("staff profile safely supports older accounts without an application", () => {
    const result = withStaffPrivateProfile({ id: "legacy-user", name: "Казак" });
    assert.deepEqual(result.privateProfile, {
        firstName: null,
        lastName: null,
        settlement: null,
        occupation: null,
        purposes: [],
        purposeNote: null,
    });
});
