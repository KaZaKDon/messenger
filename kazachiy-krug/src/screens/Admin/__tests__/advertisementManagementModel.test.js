import test from "node:test";
import assert from "node:assert/strict";
import {
    advertisementCounters,
    effectiveAdvertisementStatus,
    filterManagedAdvertisements,
    remainingPublicationLabel,
} from "../advertisementManagementModel.js";

const now = new Date("2026-08-17T12:00:00Z");
const advertisements = [
    { id: "1", chatId: "group-4", title: "Продам велосипед", settlement: "Вёшенская", status: "active", expiresAt: "2026-08-20T12:00:00Z", author: { name: "Дима", phone: "+79990000001" }, groupRule: { chat: { title: "Транспорт" } } },
    { id: "2", chatId: "group-5", title: "Щенки", settlement: "Еланская", status: "active", expiresAt: "2026-08-16T12:00:00Z", author: { name: "Иван", phone: "+79990000002" }, groupRule: { chat: { title: "Домашние животные" } } },
    { id: "3", chatId: "group-4", title: "Куплю прицеп", settlement: "Казанская", status: "needs_edit", author: { name: "Пётр", phone: "+79990000003" }, groupRule: { chat: { title: "Транспорт" } } },
];

test("an active advertisement past its deadline is displayed as expired", () => {
    assert.equal(effectiveAdvertisementStatus(advertisements[1], now), "expired");
});

test("advertisement counters use effective expiration status", () => {
    assert.deepEqual(advertisementCounters(advertisements, now), { total: 3, active: 1, needs_edit: 1, removed: 0, expired: 1, deleted: 0 });
});

test("advertisement search covers title, author, phone, place and group", () => {
    assert.deepEqual(filterManagedAdvertisements(advertisements, { query: "транспорт", now }).map((item) => item.id), ["1", "3"]);
    assert.deepEqual(filterManagedAdvertisements(advertisements, { query: "+79990000002", now }).map((item) => item.id), ["2"]);
});

test("status and group filters work together", () => {
    assert.deepEqual(filterManagedAdvertisements(advertisements, { status: "active", group: "group-4", now }).map((item) => item.id), ["1"]);
});

test("remaining publication label reports rounded days and expiry", () => {
    assert.equal(remainingPublicationLabel(advertisements[0], now), "3 дн. до окончания");
    assert.equal(remainingPublicationLabel(advertisements[1], now), "Срок истёк");
});
