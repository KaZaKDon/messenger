import test from "node:test";
import assert from "node:assert/strict";
import { getInitialAuthMode } from "../authMode.js";

test("registration link opens the registration tab", () => {
    assert.equal(getInitialAuthMode({ search: "?mode=register" }), "register");
});

test("pending application has priority over a requested tab", () => {
    assert.equal(getInitialAuthMode({
        search: "?mode=register",
        hasPendingRegistration: true,
    }), "pending");
});

test("unknown modes safely open login", () => {
    assert.equal(getInitialAuthMode({ search: "?mode=other" }), "login");
});
