import express from "express";
import cors from "cors";
import path from "path";

import authRoutes from "./routes/auth.js";
import uploadRouter from "./routes/upload.js";
import meRoutes from "./routes/me.js";

const app = express();

app.use(cors());
app.use(express.json());

// Раздача загруженных файлов
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

// Upload endpoint
app.use(uploadRouter);

// Auth
app.use("/auth", authRoutes);

// Profile
app.use(meRoutes);


app.get("/", (req, res) => {
    res.send("Kazachiy Krug server is running");
});

export default app;