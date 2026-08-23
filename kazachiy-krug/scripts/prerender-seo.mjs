import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderLandingSeoMarkup } from "../src/screens/Landing/landingContent.js";

const outputPath = resolve("dist/index.html");
const source = await readFile(outputPath, "utf8");
const root = '<div id="root"></div>';
const assetNames = await readdir(resolve("dist/assets"));

function findBuiltAsset(prefix) {
    const filename = assetNames.find((name) => name.startsWith(`${prefix}-`) && name.endsWith(".png"));
    if (!filename) throw new Error(`Не найден собранный файл ${prefix}`);
    return `/assets/${filename}`;
}

const branding = {
    eagleLogoUrl: findBuiltAsset("kazachiy-krug-eagle-v-detailed"),
    savarLogoUrl: findBuiltAsset("logo-light1"),
};

if (!source.includes(root)) {
    throw new Error("Не найден пустой #root для SEO-пререндеринга");
}

await writeFile(
    outputPath,
    source.replace(root, `<div id="root">${renderLandingSeoMarkup(branding)}</div>`),
    "utf8",
);

console.log("SEO-пререндер главной добавлен в dist/index.html");
