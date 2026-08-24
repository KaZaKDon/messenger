import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";

import { createUploadRouter } from "../../routes/upload.js";
import { createUploadRateLimiter } from "../../uploads/uploadRateLimit.js";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const TEST_ACCESS_TOKEN = "test-upload-session";

function requireTestAuth(req, res, next) {
    if (req.get("authorization") !== `Bearer ${TEST_ACCESS_TOKEN}`) {
        return res.status(401).json({ error: "Сессия недействительна" });
    }
    req.auth = { user: { id: "user-1", status: "active" } };
    return next();
}

function uploadFetch(url, options = {}) {
    return fetch(url, {
        ...options,
        headers: {
            ...(options.headers ?? {}),
            Authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
        },
    });
}

function makeImageBlob() {
    return new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });
}

function makeTextBlob() {
    return new Blob(["hello"], { type: "text/plain" });
}

function makeAudioBlob() {
    return new Blob([Uint8Array.from([79, 103, 103, 83])], { type: "audio/ogg" });
}

function makeVideoBlob() {
    return new Blob([Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112])], { type: "video/mp4" });
}

function makeLargeImageBlob() {
    return new Blob([new Uint8Array(16 * 1024 * 1024)], { type: "image/png" });
}

async function createServer({ limitUploads } = {}) {
    const app = express();
    app.use(createUploadRouter({ authenticate: requireTestAuth, limitUploads }));
    const server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const port = server.address().port;
    return {
        server,
        baseUrl: `http://127.0.0.1:${port}`,
    };
}

test("POST /upload rejects a missing session before writing a file", async () => {
    const { server, baseUrl } = await createServer();

    try {
        const before = await fs.readdir(UPLOAD_DIR).catch(() => []);
        const form = new FormData();
        form.append("file", makeImageBlob(), "unauthorized.png");

        const res = await fetch(`${baseUrl}/upload`, { method: "POST", body: form });
        assert.equal(res.status, 401);
        assert.deepEqual(await res.json(), { error: "Сессия недействительна" });

        const after = await fs.readdir(UPLOAD_DIR).catch(() => []);
        assert.equal(after.length, before.length);
    } finally {
        await closeServer(server);
    }
});

test("POST /upload rejects the eighth file in one minute before writing it", async () => {
    let currentTime = 1_000_000;
    const limitUploads = createUploadRateLimiter({ now: () => currentTime });
    const { server, baseUrl } = await createServer({ limitUploads });
    const uploadedPayloads = [];

    try {
        for (let index = 0; index < 7; index += 1) {
            const form = new FormData();
            form.append("file", makeImageBlob(), `allowed-${index}.png`);
            const res = await uploadFetch(`${baseUrl}/upload`, { method: "POST", body: form });
            assert.equal(res.status, 200);
            uploadedPayloads.push(await res.json());
        }

        const beforeRejectedRequest = await fs.readdir(UPLOAD_DIR).catch(() => []);
        const rejectedForm = new FormData();
        rejectedForm.append("file", makeImageBlob(), "rejected.png");
        const rejected = await uploadFetch(`${baseUrl}/upload`, {
            method: "POST",
            body: rejectedForm,
        });

        assert.equal(rejected.status, 429);
        assert.equal(rejected.headers.get("retry-after"), "60");
        assert.deepEqual(await rejected.json(), {
            error: "Слишком много файлов. Повторите загрузку через минуту",
            code: "UPLOAD_RATE_LIMITED",
            retryAfterSeconds: 60,
        });

        const afterRejectedRequest = await fs.readdir(UPLOAD_DIR).catch(() => []);
        assert.deepEqual(afterRejectedRequest.sort(), beforeRejectedRequest.sort());

        currentTime += 60_001;
        const resumedForm = new FormData();
        resumedForm.append("file", makeImageBlob(), "resumed.png");
        const resumed = await uploadFetch(`${baseUrl}/upload`, {
            method: "POST",
            body: resumedForm,
        });
        assert.equal(resumed.status, 200);
        uploadedPayloads.push(await resumed.json());
    } finally {
        await Promise.all(uploadedPayloads.map(cleanupUploadedFileFromPayload));
        await closeServer(server);
    }
});

test("upload rate limit is isolated by authenticated user", () => {
    const limitUploads = createUploadRateLimiter({ limit: 1, now: () => 10_000 });
    const makeResponse = () => ({
        statusCode: 200,
        headers: {},
        body: null,
        set(name, value) {
            this.headers[name] = value;
            return this;
        },
        status(value) {
            this.statusCode = value;
            return this;
        },
        json(value) {
            this.body = value;
            return this;
        },
    });

    const firstResponse = makeResponse();
    let firstContinued = false;
    limitUploads({ auth: { user: { id: "user-1" } } }, firstResponse, () => {
        firstContinued = true;
    });
    assert.equal(firstContinued, true);

    const secondResponse = makeResponse();
    let secondContinued = false;
    limitUploads({ auth: { user: { id: "user-2" } } }, secondResponse, () => {
        secondContinued = true;
    });
    assert.equal(secondContinued, true);

    const repeatedResponse = makeResponse();
    limitUploads({ auth: { user: { id: "user-1" } } }, repeatedResponse, () => {});
    assert.equal(repeatedResponse.statusCode, 429);
    assert.equal(repeatedResponse.body.code, "UPLOAD_RATE_LIMITED");
});

async function closeServer(server) {
    await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
    });
}

async function cleanupUploadedFileFromPayload(payload) {
    const fileUrl = payload?.fileUrl;
    if (!fileUrl) return;

    const filename = fileUrl.split("/").pop();
    if (!filename) return;

    const filePath = path.join(UPLOAD_DIR, filename);
    try {
        await fs.unlink(filePath);
    } catch {
        // ignore cleanup errors in test env
    }
}

test("POST /upload accepts new multipart field 'file'", async () => {
    const { server, baseUrl } = await createServer();

    try {
        const form = new FormData();
        form.append("file", makeImageBlob(), "image.png");

        const res = await uploadFetch(`${baseUrl}/upload`, { method: "POST", body: form });
        assert.equal(res.status, 200);

        const payload = await res.json();
        assert.equal(payload.ok, true);
        assert.equal(payload.mediaType, "image");
        assert.equal(typeof payload.fileUrl, "string");
        assert.equal(typeof payload.imageUrl, "string");

        await cleanupUploadedFileFromPayload(payload);
    } finally {
        await closeServer(server);
    }
});

test("POST /upload accepts legacy multipart field 'image'", async () => {
    const { server, baseUrl } = await createServer();

    try {
        const form = new FormData();
        form.append("image", makeImageBlob(), "legacy.png");

        const res = await uploadFetch(`${baseUrl}/upload`, { method: "POST", body: form });
        assert.equal(res.status, 200);

        const payload = await res.json();
        assert.equal(payload.ok, true);
        assert.equal(payload.mediaType, "image");
        assert.equal(typeof payload.fileUrl, "string");

        await cleanupUploadedFileFromPayload(payload);
    } finally {
        await closeServer(server);
    }
});

test("POST /upload rejects invalid mime type", async () => {
    const { server, baseUrl } = await createServer();

    try {
        const form = new FormData();
        form.append("file", makeTextBlob(), "note.txt");

        const res = await uploadFetch(`${baseUrl}/upload`, { method: "POST", body: form });
        assert.equal(res.status, 400);

        const payload = await res.json();
        assert.equal(payload.message, "Only image, audio and MP4/WebM video files are allowed");
    } finally {
        await closeServer(server);
    }
});

test("POST /upload rejects empty multipart payload", async () => {
    const { server, baseUrl } = await createServer();

    try {
        const form = new FormData();

        const res = await uploadFetch(`${baseUrl}/upload`, { method: "POST", body: form });
        assert.equal(res.status, 400);

        const payload = await res.json();
        assert.equal(payload.message, "No file uploaded");
    } finally {
        await closeServer(server);
    }
});



test("POST /upload accepts audio file via 'file' field", async () => {
    const { server, baseUrl } = await createServer();

    try {
        const form = new FormData();
        form.append("file", makeAudioBlob(), "voice.ogg");

        const res = await uploadFetch(`${baseUrl}/upload`, { method: "POST", body: form });
        assert.equal(res.status, 200);

        const payload = await res.json();
        assert.equal(payload.ok, true);
        assert.equal(payload.mediaType, "audio");
        assert.equal(typeof payload.fileUrl, "string");
        assert.equal(typeof payload.audioUrl, "string");

        await cleanupUploadedFileFromPayload(payload);
    } finally {
        await closeServer(server);
    }
});

test("POST /upload accepts MP4 video via 'file' field", async () => {
    const { server, baseUrl } = await createServer();

    try {
        const form = new FormData();
        form.append("file", makeVideoBlob(), "clip.mp4");

        const res = await uploadFetch(`${baseUrl}/upload`, { method: "POST", body: form });
        assert.equal(res.status, 200);

        const payload = await res.json();
        assert.equal(payload.ok, true);
        assert.equal(payload.mediaType, "video");
        assert.equal(typeof payload.videoUrl, "string");

        await cleanupUploadedFileFromPayload(payload);
    } finally {
        await closeServer(server);
    }
});

test("POST /upload rejects multipart with both 'file' and legacy 'image' fields", async () => {
    const { server, baseUrl } = await createServer();

    try {
        const form = new FormData();
        form.append("file", makeImageBlob(), "main.png");
        form.append("image", makeImageBlob(), "legacy.png");

        const res = await uploadFetch(`${baseUrl}/upload`, { method: "POST", body: form });
        assert.equal(res.status, 400);

        const payload = await res.json();
        assert.equal(payload.message, "Upload exactly one file field: file (preferred) or image (legacy).");
    } finally {
        await closeServer(server);
    }
});

test("POST /upload rejects unexpected multipart field name", async () => {
    const { server, baseUrl } = await createServer();

    try {
        const form = new FormData();
        form.append("photo", makeImageBlob(), "photo.png");

        const res = await uploadFetch(`${baseUrl}/upload`, { method: "POST", body: form });
        assert.equal(res.status, 400);

        const payload = await res.json();
        assert.equal(payload.message, "Unexpected file field: photo");
    } finally {
        await closeServer(server);
    }
});

test("POST /upload rejects oversized payload", async () => {
    const { server, baseUrl } = await createServer();

    try {
        const form = new FormData();
        form.append("file", makeLargeImageBlob(), "huge.png");

        const res = await uploadFetch(`${baseUrl}/upload`, { method: "POST", body: form });
        assert.equal(res.status, 400);

        const payload = await res.json();
        assert.equal(payload.message, "File is too large");
    } finally {
        await closeServer(server);
    }
});
