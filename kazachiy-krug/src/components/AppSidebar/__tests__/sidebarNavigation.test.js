import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("messenger sidebar no longer contains the unused favorites section", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.resolve(here, "../AppSidebar.jsx"), "utf8");
    assert.doesNotMatch(source, /\/favorites|Избранное/);
});
