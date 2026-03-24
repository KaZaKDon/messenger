import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import app from "../../app.js";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

function makeImageBlob() {
    return new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });
}

function makeTextBlob() {
    return new Blob(["hello"], { type: "text/plain" });
}

async function createServer() {
    const server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const port = server.address().port;
    return {
        server,
        baseUrl: `http://127.0.0.1:${port}`,
    };
}

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

        const res = await fetch(`${baseUrl}/upload`, { method: "POST", body: form });
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

        const res = await fetch(`${baseUrl}/upload`, { method: "POST", body: form });
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

        const res = await fetch(`${baseUrl}/upload`, { method: "POST", body: form });
        assert.equal(res.status, 400);

        const payload = await res.json();
        assert.equal(payload.message, "Only image and audio files are allowed");
    } finally {
        await closeServer(server);
    }
});

test("POST /upload rejects empty multipart payload", async () => {
    const { server, baseUrl } = await createServer();

    try {
        const form = new FormData();

        const res = await fetch(`${baseUrl}/upload`, { method: "POST", body: form });
        assert.equal(res.status, 400);

        const payload = await res.json();
        assert.equal(payload.message, "No file uploaded");
    } finally {
        await closeServer(server);
    }
});
