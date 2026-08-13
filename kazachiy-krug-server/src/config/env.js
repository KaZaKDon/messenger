function parsePort(value) {
    const port = Number.parseInt(value ?? "3000", 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("PORT must be an integer between 1 and 65535");
    }
    return port;
}

function parseOrigins(value) {
    const origins = String(value ?? "*")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    return origins.includes("*") ? "*" : origins;
}

export const env = Object.freeze({
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: parsePort(process.env.PORT),
    corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
    uploadDir: process.env.UPLOAD_DIR ?? "uploads",
    trustProxy: process.env.TRUST_PROXY === "true",
});

export function corsOrigin(origin, callback) {
    if (!origin || env.corsOrigins === "*" || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
    }

    callback(new Error("Origin is not allowed by CORS"));
}