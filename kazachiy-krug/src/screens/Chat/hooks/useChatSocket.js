import { useEffect } from "react";
import { getSocket } from "../../../shared/socket";

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

        if (!currentUser?.id) return;

        // ВАЖНО: запрашиваем список при каждом входе на экран чата.
        // Иначе после перехода в /profile или /settings и обратно
        // список кругов/чатов может остаться пустым.
        socket.emit("users:get");


        const onUsers = (users) => {
            console.log("📥 users from socket:", users);
            dispatch({ type: "SET_USERS", payload: users });
        };

        socket.on("users:list", onUsers);

        return () => {
            socket.off("users:list", onUsers);
        };
    }, [currentUser?.id, dispatch]);

    // --- OPEN CHAT (PRIVATE + GROUP) ---
    // ✅ Для групп тоже запрашиваем chat:open, чтобы получать серверную историю
    // (важно для офлайн-пользователей, которые не получали message:new в момент публикации).
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        if (!currentUser?.id || !activeChatUserId) return;

        socket.emit("chat:open", {
            from: currentUser.id,
            to: activeChatUserId,
        });

        // ✅ сервер теперь может прислать больше полей: type/title/membersInfo/otherUser
        const onChatOpened = (payload) => {
            const {
                chatId,
                messages = [],
                hasMoreHistory,
                type,
                title,
                members,
                membersInfo,
                otherUser,
                canPublish,
            } = payload || {};

            dispatch({
                type: "SET_ACTIVE_CHAT",
                payload: {
                    chatId,
                    messages,
                    hasMoreHistory,
                    type,
                    title,
                    members,
                    membersInfo,
                    otherUser,
                    canPublish,
                },

            });
        };

        socket.on("chat:opened", onChatOpened);

        return () => {
            socket.off("chat:opened", onChatOpened);
        };
    }, [activeChatUserId, currentUser?.id, dispatch]);

    // --- HISTORY PAGINATION ---
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const onHistory = ({ chatId, messages = [], hasMoreHistory = false }) => {
            if (!chatId) return;

            dispatch({
                type: "PREPEND_CHAT_HISTORY",
                payload: {
                    chatId,
                    messages,
                    hasMoreHistory,
                },
            });
        };

        socket.on("chat:history", onHistory);

        return () => {
            socket.off("chat:history", onHistory);
        };
    }, [dispatch]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const onChatError = ({ message } = {}) => {
            dispatch({
                type: "CHAT_HISTORY_ERROR",
                payload: { chatId: activeChatId ?? null },
            });

            if (message) {
                alert(message);
            }
        };

        socket.on("chat:error", onChatError);

        return () => {
            socket.off("chat:error", onChatError);
        };
    }, [activeChatId, dispatch]);


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

        const onMessageError = ({ chatId, messageId, reason }) => {
            if (chatId && messageId) {
                dispatch({
                    type: "REMOVE_MESSAGE",
                    payload: { chatId, messageId },
                });
            }

            if (reason) {
                alert(reason);
            }
        };

        socket.on("message:new", onMessage);
        socket.on("message:delivered", onDelivered);
        socket.on("message:read", onRead);
        socket.on("message:error", onMessageError);

        return () => {
            socket.off("message:new", onMessage);
            socket.off("message:delivered", onDelivered);
            socket.off("message:read", onRead);
            socket.off("message:error", onMessageError);
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