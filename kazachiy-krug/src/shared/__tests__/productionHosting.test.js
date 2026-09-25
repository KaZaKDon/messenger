import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("production frontend points to the HTTPS API and enables backend", async () => {
    const productionEnv = await readFile(".env.production", "utf8");

    assert.match(productionEnv, /^VITE_API_URL=https:\/\/api\.kazachiy-krug\.best$/m);
    assert.match(productionEnv, /^VITE_SOCKET_URL=https:\/\/api\.kazachiy-krug\.best$/m);
    assert.match(productionEnv, /^VITE_BACKEND_ENABLED=true$/m);
});

test("shared hosting config preserves real SPA routes and returns a real 404 for unknown URLs", async () => {
    const [htaccess, notFound] = await Promise.all([
        readFile("public/.htaccess", "utf8"),
        readFile("public/404.html", "utf8"),
    ]);

    assert.match(htaccess, /RewriteCond %\{REQUEST_FILENAME\} -f/);
    assert.match(htaccess, /RewriteCond %\{REQUEST_FILENAME\} -d/);
    assert.match(htaccess, /ErrorDocument 404 \/404\.html/);
    assert.match(htaccess, /phone\|code\|chat\|settings/);
    assert.ok(htaccess.includes("admin/users/(?:registrations|password-recoveries)"));
    assert.match(htaccess, /RewriteRule \^ - \[R=404,L\]/);
    assert.match(notFound, /<meta name="robots" content="noindex, nofollow">/);
});

test("search files expose only the public landing page", async () => {
    const [robots, sitemap] = await Promise.all([
        readFile("public/robots.txt", "utf8"),
        readFile("public/sitemap.xml", "utf8"),
    ]);
    assert.match(robots, /Sitemap: https:\/\/kazachiy-krug\.best\/sitemap\.xml/);
    assert.match(sitemap, /<loc>https:\/\/kazachiy-krug\.best\/<\/loc>/);
    assert.doesNotMatch(sitemap, /\/chat|\/admin|\/phone/);
});

