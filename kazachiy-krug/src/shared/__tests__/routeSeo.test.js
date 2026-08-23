import test from "node:test";
import assert from "node:assert/strict";
import { getRouteSeo, PUBLIC_SITE_URL } from "../routeSeo.js";

test("public landing is indexable and has one canonical address", () => {
    const seo = getRouteSeo("/");
    assert.equal(seo.robots, "index, follow");
    assert.equal(seo.canonical, `${PUBLIC_SITE_URL}/`);
    assert.match(seo.title, /Казачий круг/);
});

test("messenger and administration routes are excluded from search", () => {
    for (const path of ["/phone", "/chat", "/profile", "/admin"]) {
        const seo = getRouteSeo(path);
        assert.equal(seo.robots, "noindex, nofollow");
        assert.equal(seo.canonical, null);
    }
});
