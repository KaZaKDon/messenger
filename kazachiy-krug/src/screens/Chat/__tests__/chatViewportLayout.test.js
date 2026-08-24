import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const chatCss = readFileSync(fileURLToPath(new URL("../chat.css", import.meta.url)), "utf8");
const dialogList = readFileSync(fileURLToPath(new URL("../components/DialogList.jsx", import.meta.url)), "utf8");
const chatWindowSource = readFileSync(fileURLToPath(new URL("../components/ChatWindow.jsx", import.meta.url)), "utf8");
const chatScreenSource = readFileSync(fileURLToPath(new URL("../Chat.jsx", import.meta.url)), "utf8");

test("chat stays inside the viewport and scrolls messages independently", () => {
    assert.match(chatCss, /\.chat-main[\s\S]*?height:\s*100dvh/);
    assert.match(chatCss, /\.chat-window[\s\S]*?overflow:\s*hidden/);
    assert.match(chatCss, /\.messages[\s\S]*?overflow-y:\s*auto/);
    assert.match(chatCss, /\.chat-input[\s\S]*?flex:\s*0 0 auto/);
});

test("dialog cards have their own scroll area below fixed search", () => {
    assert.match(dialogList, /className="dialog-items-scroll"/);
    assert.match(chatCss, /\.dialog-items-scroll[\s\S]*?overflow-y:\s*auto/);
    assert.match(chatCss, /\.dialog-search[\s\S]*?flex:\s*0 0 auto/);
});

test("announcement form scrolls inside the chat and keeps submit visible", () => {
    assert.match(chatCss, /\.announce-screen[\s\S]*?flex:\s*1/);
    assert.match(chatCss, /\.announce-screen[\s\S]*?min-height:\s*0/);
    assert.match(chatCss, /\.announce-screen[\s\S]*?overflow-y:\s*auto/);
    assert.match(chatCss, /\.announce-send[\s\S]*?position:\s*sticky/);
    assert.match(chatCss, /\.announce-send[\s\S]*?bottom:\s*0/);
});

test("chat opens at the latest publication while older content stays above", () => {
    assert.match(chatWindowSource, /messagesViewportRef/);
    assert.match(chatWindowSource, /scrollToLatest\("auto"\)/);
    assert.match(chatWindowSource, /return aTime - bTime/);
    assert.match(chatWindowSource, /isHistoryPrepend/);
    assert.match(chatWindowSource, /scheduleLatestViewport/);
});

test("mobile chat has an explicit return to every dialog", () => {
    assert.match(chatWindowSource, /<span>Чаты<\/span>/);
    assert.match(chatScreenSource, /onBackToList/);
    assert.match(chatScreenSource, /SET_ACTIVE_CHAT_USER", payload: null/);
});
