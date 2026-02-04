import { io } from "socket.io-client";

let socket = null;

export function connectSocket() {
    if (!socket) {
        socket = io("http://localhost:3000", {
            transports: ["websocket"],
            autoConnect: false
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