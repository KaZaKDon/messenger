import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const frameSource = readFileSync(fileURLToPath(new URL("../AppFrame.jsx", import.meta.url)), "utf8");
const frameCss = readFileSync(fileURLToPath(new URL("../AppFrame.css", import.meta.url)), "utf8");
const chatCss = readFileSync(fileURLToPath(new URL("../../screens/Chat/chat.css", import.meta.url)), "utf8");

test("mobile application bar keeps menu and theme-aware eagle above content", () => {
    assert.match(frameSource, /className="app-frame-mobile-bar"/);
    assert.match(frameSource, /isNightMode \? logoDark : logoLight/);
    assert.match(frameSource, /className="app-frame-mobile-logo"/);
    assert.doesNotMatch(frameSource, /app-frame-mobile-bar[\s\S]*?КАЗАЧИЙ КРУГ/);
});

test("mobile content uses the viewport space below its own header", () => {
    assert.match(frameCss, /\.app-frame-mobile-bar[\s\S]*?flex:\s*0 0 56px/);
    assert.match(frameCss, /\.app-frame-content[\s\S]*?height:\s*calc\(100dvh - 56px\)/);
    assert.match(chatCss, /@media \(max-width: 899px\)[\s\S]*?\.chat-main[\s\S]*?height:\s*100%/);
});
