import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { env } from "../config/env.js";
import { requireAuth } from "../auth/middleware.js";
import { createUploadRateLimiter } from "../uploads/uploadRateLimit.js";

const UPLOAD_DIR = path.resolve(process.cwd(), env.uploadDir);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const AUDIO_EXTENSIONS = [".ogg", ".oga", ".mp3", ".wav", ".m4a", ".webm"];
const VIDEO_EXTENSIONS = [".mp4", ".webm"];
const STANDARD_FILE_LIMIT = 15 * 1024 * 1024;
const VIDEO_FILE_LIMIT = 50 * 1024 * 1024;

function isImageMime(mimetype = "") {
    return mimetype.startsWith("image/");
}

function isAudioMime(mimetype = "") {
    return mimetype.startsWith("audio/");
}

function isVideoMime(mimetype = "") {
    return mimetype === "video/mp4" || mimetype === "video/webm";
}

function pickUploadedFile(files = {}) {
    const fromFile = Array.isArray(files.file) ? files.file[0] : null;
    const fromLegacyImage = Array.isArray(files.image) ? files.image[0] : null;

    if (fromFile && fromLegacyImage) {
        return { error: "Upload exactly one file field: file (preferred) or image (legacy)." };
    }

    return { file: fromFile ?? fromLegacyImage ?? null };
}


function toUploadErrorResponse(err) {
    if (!err) return null;

    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return { status: 400, message: "File is too large" };
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return { status: 400, message: `Unexpected file field: ${err.field ?? "unknown"}` };
        }
        return { status: 400, message: err.message };
    }

    if (err instanceof Error) {
        return { status: 400, message: err.message || "Upload failed" };
    }

    return { status: 500, message: "Upload failed" };
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase();

        let safeExt = ".bin";
        if (isImageMime(file.mimetype)) {
            safeExt = IMAGE_EXTENSIONS.includes(ext) ? ext : ".png";
        } else if (isAudioMime(file.mimetype)) {
            safeExt = AUDIO_EXTENSIONS.includes(ext) ? ext : ".ogg";
        } else if (isVideoMime(file.mimetype)) {
            safeExt = VIDEO_EXTENSIONS.includes(ext) ? ext : ".mp4";
        }

        cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${safeExt}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: VIDEO_FILE_LIMIT },
    fileFilter: (_req, file, cb) => {
        if (!isImageMime(file.mimetype) && !isAudioMime(file.mimetype) && !isVideoMime(file.mimetype)) {
            return cb(new Error("Only image, audio and MP4/WebM video files are allowed"));
        }
        cb(null, true);
    },
});

export function createUploadRouter({
    authenticate = requireAuth,
    limitUploads = createUploadRateLimiter(),
} = {}) {
    const router = Router();

    router.post(
        "/upload",
        authenticate,
        limitUploads,
        upload.fields([
            { name: "file", maxCount: 1 },
            { name: "image", maxCount: 1 },
        ]),
        (req, res) => {
            const { file, error } = pickUploadedFile(req.files);
            if (error) return res.status(400).json({ message: error });
            if (!file) return res.status(400).json({ message: "No file uploaded" });
            if (!isVideoMime(file.mimetype) && file.size > STANDARD_FILE_LIMIT) {
                fs.unlink(file.path, () => {});
                return res.status(400).json({ message: "File is too large" });
            }

            const baseUrl = `${req.protocol}://${req.get("host")}`;
            const fileUrl = `${baseUrl}/uploads/${file.filename}`;
            const mediaType = isVideoMime(file.mimetype)
                ? "video"
                : (isAudioMime(file.mimetype) ? "audio" : "image");

            res.json({
                ok: true,
                fileUrl,
                imageUrl: mediaType === "image" ? fileUrl : null,
                audioUrl: mediaType === "audio" ? fileUrl : null,
                videoUrl: mediaType === "video" ? fileUrl : null,
                mediaType,
                filename: file.filename,
                size: file.size,
                mimetype: file.mimetype,
            });
        }
    );

    router.use((err, _req, res, next) => {
        if (!err) return next();

        const normalized = toUploadErrorResponse(err);
        if (!normalized) return next();

        return res.status(normalized.status).json({ message: normalized.message });
    });

    return router;
}

export default createUploadRouter();
