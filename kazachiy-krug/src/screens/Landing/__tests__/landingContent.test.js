import test from "node:test";
import assert from "node:assert/strict";
import {
    landingBranding,
    landingHero,
    landingSections,
    renderLandingSeoMarkup,
} from "../landingContent.js";

test("public landing has direct login and registration actions", () => {
    assert.equal(landingHero.loginHref, "/phone");
    assert.equal(landingHero.registerHref, "/phone?mode=register");
    assert.match(landingHero.subtitle, /собираются свои/i);
});

test("public landing contains four concise explanatory sections", () => {
    assert.equal(landingSections.length, 4);
    assert.deepEqual(
        landingSections.map((section) => section.id),
        ["possibilities", "advertisements", "registration", "safety"],
    );
});

test("SEO prerender includes meaningful content and working links", () => {
    const markup = renderLandingSeoMarkup({
        eagleLogoUrl: "/assets/eagle.png",
        savarLogoUrl: "/assets/savar.png",
    });
    assert.match(markup, /<h1[^>]*>Казачий круг<\/h1>/);
    assert.match(markup, /href="\/phone"/);
    assert.match(markup, /href="\/phone\?mode=register"/);
    assert.match(markup, /Модерация без чтения личных чатов/);
    assert.match(markup, /src="\/assets\/eagle.png"/);
    assert.match(markup, /src="\/assets\/savar.png"/);
    assert.match(markup, /href="https:\/\/vkazakdon.ru"/);
    assert.equal(landingBranding.studioLabel, "VKazakDon Studio");
});
