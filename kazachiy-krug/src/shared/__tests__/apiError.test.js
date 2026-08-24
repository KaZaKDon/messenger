import test from "node:test";
import assert from "node:assert/strict";

import { readApiError } from "../apiError.js";

function responseWith(text) {
    return { text: async () => text };
}

test("API error reader extracts a safe server error", async () => {
    const message = await readApiError(responseWith(JSON.stringify({
        error: "Слишком много файлов. Повторите загрузку через минуту",
    })));
    assert.equal(message, "Слишком много файлов. Повторите загрузку через минуту");
});

test("API error reader supports message payload and plain text", async () => {
    assert.equal(
        await readApiError(responseWith(JSON.stringify({ message: "Файл слишком большой" }))),
        "Файл слишком большой"
    );
    assert.equal(await readApiError(responseWith("Upload failed")), "Upload failed");
});

test("API error reader uses fallback for an empty response", async () => {
    assert.equal(await readApiError(responseWith(""), "Не удалось загрузить файл"), "Не удалось загрузить файл");
});

