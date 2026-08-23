import assert from "node:assert/strict";
import test from "node:test";

import { moveViewportToLatest, scheduleLatestViewport } from "../chatViewport.js";

test("mobile chat moves its own message viewport to the latest content", () => {
    const calls = [];
    const viewport = {
        scrollHeight: 1234,
        scrollTo: (options) => calls.push(options),
    };

    moveViewportToLatest(viewport, "auto");
    assert.deepEqual(calls, [{ top: 1234, behavior: "auto" }]);
});

test("latest scroll is repeated after layout settles", () => {
    const calls = [];
    const frames = [];
    const timers = [];
    const viewport = {
        scrollHeight: 800,
        scrollTo: (options) => calls.push(options),
    };

    scheduleLatestViewport({
        getViewport: () => viewport,
        behavior: "smooth",
        requestFrame: (callback) => { frames.push(callback); return frames.length; },
        cancelFrame: () => {},
        setTimer: (callback) => { timers.push(callback); return timers.length; },
        clearTimer: () => {},
    });

    frames.shift()();
    frames.shift()();
    timers.shift()();

    assert.deepEqual(calls, [
        { top: 800, behavior: "smooth" },
        { top: 800, behavior: "smooth" },
        { top: 800, behavior: "auto" },
    ]);
});
