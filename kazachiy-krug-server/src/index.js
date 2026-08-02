import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import { initSocket } from "./socket/index.js";

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

initSocket(io);

server.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
