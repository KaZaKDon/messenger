import { useEffect } from "react";
import { getSocket } from "../../../shared/socket";

export function useChatSocket(
    dispatch,
    currentUser,
    activeChatUserId,
    activeChatId
) {

    useEffect(() => {

        const socket = getSocket();
        if (!socket) return;

        if (!currentUser?.id) {
            socket.userListRequested = false;
            return;
        }

        if (!socket.userListRequested) {
            socket.userListRequested = true;
            // 🔹 запрос списка пользователей
            socket.emit("users:get");
        }


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
    }, [currentUser?.id, dispatch])
    
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        if (!currentUser?.id || !activeChatUserId) return;

        socket.emit("chat:open", {
            from: currentUser.id,
            to: activeChatUserId
        });

        const onChatOpened = ({ chatId, messages }) => {
            dispatch({
                type: "SET_ACTIVE_CHAT",
                payload: { chatId, messages }
            });
        };

        socket.on("chat:opened", onChatOpened);

        return () => {
            socket.off("chat:opened", onChatOpened);
        };
    }, [activeChatUserId, currentUser?.id, dispatch]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        if (!currentUser?.id || !activeChatId) return;

        socket.emit("join:chat", { chatId: activeChatId });

        const onMessage = (message) => {
            dispatch({
                type: "RECEIVE_MESSAGE",
                payload: {
                    chatId: message.chatId,
                    message
                }
            });
        };

        socket.on("message:new", onMessage);

        return () => {
            socket.off("message:new", onMessage);
        };
    }, [activeChatId, currentUser?.id, dispatch]);
}
