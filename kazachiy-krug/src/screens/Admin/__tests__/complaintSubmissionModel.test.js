import assert from "node:assert/strict";
import test from "node:test";

import { ADVERTISEMENT_COMPLAINT_REASONS, canSubmitComplaint } from "../../../shared/complaintModel.js";

test("advertisement complaint offers the agreed reasons", () => {
    assert.ok(ADVERTISEMENT_COMPLAINT_REASONS.includes("Текст не соответствует фотографиям"));
    assert.ok(ADVERTISEMENT_COMPLAINT_REASONS.includes("Мошенничество или подозрительное предложение"));
});

test("complaint requires a known reason and an explanation", () => {
    assert.equal(canSubmitComplaint({ reason: ADVERTISEMENT_COMPLAINT_REASONS[0], details: "Неверный раздел" }), true);
    assert.equal(canSubmitComplaint({ reason: ADVERTISEMENT_COMPLAINT_REASONS[0], details: "" }), false);
    assert.equal(canSubmitComplaint({ reason: "Неизвестно", details: "Описание" }), false);
});
