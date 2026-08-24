import assert from "node:assert/strict";
import test from "node:test";

import { authHeaders } from "../authHeaders.js";

test("authenticated upload sends the current bearer token", () => {
    const storage = { getItem: (key) => key === "accessToken" ? "session-token" : null };

    assert.deepEqual(authHeaders(storage), {
        Authorization: "Bearer session-token",
    });
});

test("upload does not invent an authorization header without a session", () => {
    const storage = { getItem: () => null };

    assert.deepEqual(authHeaders(storage), {});
});
