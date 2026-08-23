import assert from "node:assert/strict";
import test from "node:test";

import { advertisementDialogMeta } from "../advertisementDialogMeta.js";

test("advertisement dialog shows latest title and unread counter", () => {
    assert.deepEqual(advertisementDialogMeta({
        latestTitle: "Продам прицеп",
        latestPublishedAt: "2026-08-21T12:00:00.000Z",
        unread: 2,
    }), {
        preview: "Продам прицеп",
        timestamp: "2026-08-21T12:00:00.000Z",
        unread: 2,
    });
});

test("empty advertisement group has a specific preview", () => {
    assert.equal(advertisementDialogMeta({ total: 0, unread: 0 }).preview, "Нет объявлений");
});
