import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { env } from "../config/env.js";

export const AVATAR_FILE_LIMIT = 5 * 1024 * 1024;
export const AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const uploadDirectory = path.resolve(process.cwd(), env.uploadDir);
fs.mkdirSync(uploadDirectory, { recursive: true });

const extensionByMime = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
};

export function isAllowedAvatarMime(mimeType) {
    return AVATAR_MIME_TYPES.has(String(mimeType ?? "").toLowerCase());
}

export const avatarUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, callback) => callback(null, uploadDirectory),
        filename: (_req, file, callback) => {
            callback(null, `avatar-${Date.now()}-${Math.random().toString(16).slice(2)}${extensionByMime[file.mimetype]}`);
        },
    }),
    limits: { fileSize: AVATAR_FILE_LIMIT },
    fileFilter: (_req, file, callback) => {
        if (!isAllowedAvatarMime(file.mimetype)) {
            return callback(new Error("Для аватара разрешены только JPG, PNG и WebP"));
        }
        callback(null, true);
    },
});

export function removeLocalAvatar(avatarUrl) {
    if (!avatarUrl) return;
    try {
        const filename = path.basename(new URL(avatarUrl).pathname);
        if (!filename.startsWith("avatar-")) return;
        fs.unlink(path.join(uploadDirectory, filename), () => {});
    } catch {
        // External and malformed URLs are never removed from the local filesystem.
    }
}
