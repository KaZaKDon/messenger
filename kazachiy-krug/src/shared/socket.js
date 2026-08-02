import { io } from "socket.io-client";
import { SOCKET_URL } from "./config";

let socket = null;

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