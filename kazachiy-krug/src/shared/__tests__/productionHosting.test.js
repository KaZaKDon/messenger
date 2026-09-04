import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("production frontend points to the HTTPS API and enables backend", async () => {
    const productionEnv = await readFile(".env.production", "utf8");

    assert.match(productionEnv, /^VITE_API_URL=https:\/\/api\.kazachiy-krug\.best$/m);
    assert.match(productionEnv, /^VITE_SOCKET_URL=https:\/\/api\.kazachiy-krug\.best$/m);
    assert.match(productionEnv, /^VITE_BACKEND_ENABLED=true$/m);
});

test("shared hosting config preserves files and falls back to React Router", async () => {
    const htaccess = await readFile("public/.htaccess", "utf8");
    assert.match(htaccess, /RewriteCond %\{REQUEST_FILENAME\} -f/);
    assert.match(htaccess, /RewriteCond %\{REQUEST_FILENAME\} -d/);
    assert.match(htaccess, /RewriteRule \^ index\.html \[L\]/);
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

