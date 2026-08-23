import assert from "node:assert/strict";
import test from "node:test";

import { PROFILE_FIELDS, profileDetails } from "../profileFields.js";

test("only settlement and occupation are editable profile fields", () => {
    assert.deepEqual(Object.keys(PROFILE_FIELDS), ["settlement", "occupation"]);
    assert.equal(PROFILE_FIELDS.settlement.label, "Населённый пункт");
});

test("profile details keep phone read-only and safely label missing values", () => {
    assert.deepEqual(profileDetails({ phone: "+79990000000" }), {
        phone: "+79990000000",
        settlement: "Не указано",
        occupation: "Не указано",
    });
});
