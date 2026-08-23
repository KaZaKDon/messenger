import test from "node:test";
import assert from "node:assert/strict";
import { acquireCallMedia, getCallMediaConstraints } from "../callMedia.js";

test("audio call requests microphone without camera", () => {
    const constraints = getCallMediaConstraints("audio");
    assert.equal(constraints.video, false);
    assert.equal(constraints.audio.echoCancellation, true);
});

test("video call requests microphone and front camera", () => {
    const constraints = getCallMediaConstraints("video");
    assert.deepEqual(constraints.video, { facingMode: "user" });
    assert.equal(constraints.audio.noiseSuppression, true);
});

test("video call keeps audio when camera is busy", async () => {
    const audioTrack = { kind: "audio" };
    const audioStream = {
        addTrack() {},
        getVideoTracks: () => [],
        getAudioTracks: () => [audioTrack],
    };
    const requests = [];
    const getUserMedia = async (constraints) => {
        requests.push(constraints);
        if (constraints.video) throw new Error("camera busy");
        return audioStream;
    };

    const result = await acquireCallMedia("video", getUserMedia);
    assert.equal(result.stream, audioStream);
    assert.equal(result.videoAvailable, false);
    assert.match(result.videoError.message, /camera busy/);
    assert.equal(requests.length, 2);
});

test("video call adds camera track after microphone is ready", async () => {
    const addedTracks = [];
    const videoTrack = { kind: "video" };
    const audioStream = {
        addTrack: (track) => addedTracks.push(track),
        getVideoTracks: () => addedTracks,
    };
    const videoStream = { getVideoTracks: () => [videoTrack] };
    const getUserMedia = async (constraints) => constraints.video ? videoStream : audioStream;

    const result = await acquireCallMedia("video", getUserMedia);
    assert.equal(result.videoAvailable, true);
    assert.deepEqual(addedTracks, [videoTrack]);
});
