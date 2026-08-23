import assert from "node:assert/strict";
import test from "node:test";

import { complaintCounters, filterManagedComplaints } from "../complaintManagementModel.js";

const complaints = [
    { id: "1", status: "new", reason: "Спам", targetSnapshot: { title: "Продам" }, reporter: { name: "Иван" } },
    { id: "2", status: "resolved", reason: "Не та группа", targetSnapshot: { title: "Куплю", groupTitle: "Транспорт" }, reporter: { name: "Мария" } },
];

test("complaint counters separate the moderation queue", () => {
    assert.deepEqual(complaintCounters(complaints), { total: 2, new: 1, in_review: 0, resolved: 1, rejected: 0 });
});

test("complaint filters search the reason, snapshot and reporter", () => {
    assert.deepEqual(filterManagedComplaints(complaints, { query: "иван" }).map((item) => item.id), ["1"]);
    assert.deepEqual(filterManagedComplaints(complaints, { query: "транспорт", status: "resolved" }).map((item) => item.id), ["2"]);
});
