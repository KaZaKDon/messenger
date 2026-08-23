import assert from "node:assert/strict";
import test from "node:test";

import { filterSupportRequests, supportCounters, validSupportDraft } from "../../../shared/supportRequestModel.js";

const requests = [
    { id: "1", category: "question", subject: "Вопрос по группе", status: "new", author: { name: "Иван" } },
    { id: "2", category: "technical", subject: "Не работает камера", status: "answered", author: { name: "Мария" } },
];

test("support request draft requires category, subject and text", () => {
    assert.equal(validSupportDraft({ category: "question", subject: "Доступ", text: "Как войти?" }), true);
    assert.equal(validSupportDraft({ category: "", subject: "Доступ", text: "Как войти?" }), false);
});

test("support counters and filters describe the queue", () => {
    assert.deepEqual(supportCounters(requests), { total: 2, new: 1, in_progress: 0, answered: 1, closed: 0 });
    assert.deepEqual(filterSupportRequests(requests, "камера", "answered").map((item) => item.id), ["2"]);
});
