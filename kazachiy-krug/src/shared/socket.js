import { io } from "socket.io-client";

let socket = null;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3000";

export function connectSocket() {
    if (!socket) {
        socket = io(SOCKET_URL, {
            transports: ["websocket", "polling"],
            autoConnect: false,
        });

        socket.on("connect_error", (error) => {
            console.error("Socket connect_error:", error?.message ?? error);

        });
    }

    if (!socket.connected) {
        socket.connect();
    }

    return socket;
}


export function getSocket() {
    return socket;
}