import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import { initSocket } from "./socket/index.js";
import { env, corsOrigin } from "./config/env.js";
import { prisma } from "./db/prisma.js";

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: corsOrigin,
    },
});

app.set("io", io);

initSocket(io);

server.listen(env.port, "0.0.0.0", () => {
    console.log(`Server started on port ${env.port}`);
});

let shuttingDown = false;
async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down`);

    const forceExit = setTimeout(() => process.exit(1), 10_000);
    forceExit.unref();

    io.close();
    server.close(async () => {
        await prisma.$disconnect();
        clearTimeout(forceExit);
        process.exit(0);
    });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
