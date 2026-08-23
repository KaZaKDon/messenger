import assert from "node:assert/strict";
import test from "node:test";

import { createHttpErrorHandler } from "../errorHandler.js";
import { DomainError } from "../../domain/DomainError.js";

function createResponse() {
    return {
        statusCode: null,
        payload: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.payload = payload;
            return this;
        },
    };
}

test("malformed JSON returns a safe JSON error without logging a stack", () => {
    let logged = false;
    const handler = createHttpErrorHandler({
        logger: { error: () => { logged = true; } },
    });
    const response = createResponse();

    handler({ type: "entity.parse.failed" }, {}, response, () => {});

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.payload, { error: "Некорректный JSON в теле запроса" });
    assert.equal(logged, false);
});

test("unexpected HTTP errors are logged but not exposed to the client", () => {
    let loggedError = null;
    const handler = createHttpErrorHandler({
        logger: { error: (_message, error) => { loggedError = error; } },
    });
    const response = createResponse();
    const error = new Error("database secret and local path");

    handler(error, {}, response, () => {});

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.payload, { error: "Внутренняя ошибка сервера" });
    assert.equal(loggedError, error);
    assert.doesNotMatch(JSON.stringify(response.payload), /database secret|local path/);
});

test("domain errors preserve a safe code and field without server logging", () => {
    let logged = false;
    const handler = createHttpErrorHandler({
        logger: { error: () => { logged = true; } },
    });
    const response = createResponse();

    handler(new DomainError("Добавьте фотографию", {
        code: "VALIDATION_ERROR",
        statusCode: 400,
        field: "images",
    }), {}, response, () => {});

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.payload, {
        error: "Добавьте фотографию",
        code: "VALIDATION_ERROR",
        field: "images",
    });
    assert.equal(logged, false);
});
