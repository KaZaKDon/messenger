import { useEffect } from "react";
import { getSocket } from "../../../shared/socket";

export function useChatSocket(dispatch, currentUser) {
    useEffect(() => {
        if (!currentUser?.id) return;

        const socket = getSocket();
        if (!socket) return;

        // 🔹 запрос списка пользователей
        socket.emit("users:get");

        const onUsers = (users) => {
            console.log("📥 users from socket:", users);

            dispatch({
                type: "SET_USERS",
                payload: users
            });
        };

        socket.on("users:list", onUsers);

        return () => {
            socket.off("users:list", onUsers);
        };
    }, [currentUser?.id, dispatch]);
}