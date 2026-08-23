import express from "express";
import cors from "cors";
import path from "path";

import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import uploadRouter from "./routes/upload.js";
import meRoutes from "./routes/me.js";
import advertisementRoutes from "./routes/advertisements.js";
import complaintRoutes from "./routes/complaints.js";
import supportRequestRoutes from "./routes/supportRequests.js";
import moderationRoutes from "./routes/moderation.js";
import settlementRoutes from "./routes/settlements.js";
import userBlockRoutes from "./routes/userBlocks.js";
import { corsOrigin, env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { httpErrorHandler } from "./http/errorHandler.js";

const app = express();

if (env.trustProxy) app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" }));

// Раздача загруженных файлов
app.use("/uploads", express.static(path.resolve(process.cwd(), env.uploadDir)));

// Upload endpoint
app.use(uploadRouter);

// Auth
app.use("/auth", authRoutes);

// Administration
app.use("/admin", adminRoutes);

// Shared administration/moderation API. Registration forms and payments remain
// under /admin and therefore are never exposed to moderators.
app.use("/moderation", moderationRoutes);

// Structured advertisements and user feedback.
app.use("/advertisements", advertisementRoutes);
app.use("/settlements", settlementRoutes);
app.use("/complaints", complaintRoutes);
app.use("/support-requests", supportRequestRoutes);
app.use("/me/blocks", userBlockRoutes);

// Profile
app.use(meRoutes);


app.get("/", (req, res) => {
    res.send("Kazachiy Krug server is running");
});

app.get("/health/live", (_req, res) => {
    res.json({ status: "ok" });
});

app.get("/health/ready", async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: "ready" });
    } catch {
        res.status(503).json({ status: "unavailable" });
    }
});

// Must be registered after every route so malformed input and unexpected
// failures never expose an HTML stack trace to API clients.
app.use(httpErrorHandler);

export default app;
