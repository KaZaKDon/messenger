import { useEffect } from "react";
import { getSocket } from "../../../shared/socket";

const isGroupId = (id) => typeof id === "string" && id.startsWith("group-");

export function useChatSocket(
    dispatch,
    currentUser,
    activeChatUserId,
    activeChatId,
    activeChatMessages = []
) {
    // --- USERS LIST ---
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        if (!currentUser?.id) {
            socket.userListRequested = false;
            return;
        }

        if (!socket.userListRequested) {
            socket.userListRequested = true;
            socket.emit("users:get");
        }

        const onUsers = (users) => {
            console.log("📥 users from socket:", users);
            dispatch({ type: "SET_USERS", payload: users });
        };

        socket.on("users:list", onUsers);

        return () => {
            socket.off("users:list", onUsers);
        };
    }, [currentUser?.id, dispatch]);

    // --- OPEN CHAT (PRIVATE ONLY) ---
    // ⚠️ Группы НЕ открываем через chat:open — activeChatId у них = group-N сразу.
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        if (!currentUser?.id || !activeChatUserId) return;

        // ✅ группы пропускаем
        if (isGroupId(activeChatUserId)) return;

        socket.emit("chat:open", {
            from: currentUser.id,
            to: activeChatUserId,
        });

        // ✅ сервер теперь может прислать больше полей: type/title/membersInfo/otherUser
        const onChatOpened = (payload) => {
            const {
                chatId,
                messages = [],
                type,
                title,
                members,
                membersInfo,
                otherUser,
            } = payload || {};

            dispatch({
                type: "SET_ACTIVE_CHAT",
                payload: { chatId, messages, type, title, members, membersInfo, otherUser },
            });
        };

        socket.on("chat:opened", onChatOpened);

        return () => {
            socket.off("chat:opened", onChatOpened);
        };
    }, [activeChatUserId, currentUser?.id, dispatch]);

    // --- JOIN + MESSAGE LISTENERS (PRIVATE + GROUP) ---
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
                    message,
                },
            });

            if (
                message.chatId === activeChatId &&
                message.senderId !== currentUser.id
            ) {
                socket.emit("message:read", {
                    chatId: message.chatId,
                    messageId: message.id,
                });
            }
        };

        const onDelivered = ({ chatId, messageId }) => {
            dispatch({
                type: "UPDATE_MESSAGE_STATUS",
                payload: { chatId, messageId, status: "delivered" },
            });
        };

        const onRead = ({ chatId, messageId }) => {
            dispatch({
                type: "UPDATE_MESSAGE_STATUS",
                payload: { chatId, messageId, status: "read" },
            });
        };

        socket.on("message:new", onMessage);
        socket.on("message:delivered", onDelivered);
        socket.on("message:read", onRead);

        return () => {
            socket.off("message:new", onMessage);
            socket.off("message:delivered", onDelivered);
            socket.off("message:read", onRead);
        };
    }, [activeChatId, currentUser?.id, dispatch]);

    // --- MARK ALL AS READ (when opening chat) ---
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        if (!currentUser?.id || !activeChatId) return;
        if (!activeChatMessages?.length) return;

        activeChatMessages
            .filter(
                (message) =>
                    message.senderId !== currentUser.id && message.status !== "read"
            )
            .forEach((message) => {
                socket.emit("message:read", {
                    chatId: activeChatId,
                    messageId: message.id,
                });

                dispatch({
                    type: "UPDATE_MESSAGE_STATUS",
                    payload: {
                        chatId: activeChatId,
                        messageId: message.id,
                        status: "read",
                    },
                });
            });
    }, [activeChatId, activeChatMessages, currentUser?.id, dispatch]);
}