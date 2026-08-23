import assert from "node:assert/strict";
import test from "node:test";

import {
    ADVERTISEMENT_MODERATION_REASONS,
    buildModerationReason,
    moderationActionLabel,
} from "../advertisementModerationModel.js";

test("advertisement moderation has separate revision and final removal reasons", () => {
    assert.ok(ADVERTISEMENT_MODERATION_REASONS.needs_edit.includes("Выбрана неправильная группа"));
    assert.ok(ADVERTISEMENT_MODERATION_REASONS.removed.includes("Мошенничество или подозрение на него"));
    assert.equal(moderationActionLabel("needs_edit"), "Отправить на исправление");
    assert.equal(moderationActionLabel("removed"), "Снять окончательно");
});

test("moderation reason requires both a category and an explanation", () => {
    assert.equal(buildModerationReason("Спам", "Повторная публикация"), "Спам. Повторная публикация");
    assert.equal(buildModerationReason("Спам", ""), "");
    assert.equal(buildModerationReason("", "Комментарий"), "");
});
