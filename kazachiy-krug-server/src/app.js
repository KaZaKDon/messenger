import express from "express";
import cors from "cors";
import path from "path";

import authRoutes from "./routes/auth.js";
import uploadRouter from "./routes/upload.js";
import meRoutes from "./routes/me.js";
import { corsOrigin, env } from "./config/env.js";
import { prisma } from "./db/prisma.js";

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

export default app;