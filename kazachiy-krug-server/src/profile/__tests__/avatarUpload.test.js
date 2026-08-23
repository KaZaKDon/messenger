import test from "node:test";
import assert from "node:assert/strict";
import { AVATAR_FILE_LIMIT, isAllowedAvatarMime } from "../avatarUpload.js";

test("avatar accepts JPG, PNG and WebP up to five megabytes", () => {
    assert.equal(AVATAR_FILE_LIMIT, 5 * 1024 * 1024);
    assert.equal(isAllowedAvatarMime("image/jpeg"), true);
    assert.equal(isAllowedAvatarMime("image/png"), true);
    assert.equal(isAllowedAvatarMime("image/webp"), true);
});

test("avatar rejects GIF, SVG and non-image files", () => {
    assert.equal(isAllowedAvatarMime("image/gif"), false);
    assert.equal(isAllowedAvatarMime("image/svg+xml"), false);
    assert.equal(isAllowedAvatarMime("application/pdf"), false);
});
