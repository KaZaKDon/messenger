import { useEffect } from "react";
import { getSocket } from "../../../shared/socket";

function formatCallNotice(eventName, payload = {}, currentUserId) {
    const typeLabel = payload?.type === "video" ? "видеозвонок" : "аудиозвонок";

    if (eventName === "call:incoming") return `Входящий ${typeLabel}`;
    if (eventName === "call:ringing") return `Исходящий ${typeLabel}: звонит...`;
    if (eventName === "call:accepted") return `Звонок принят (${typeLabel})`;
    if (eventName === "call:declined") return `Звонок отклонён (${typeLabel})`;
    if (eventName === "call:ended") {
        if (payload?.endedReason === "timeout") return `${typeLabel}: пропущен`;
        if (payload?.endedBy && payload.endedBy === currentUserId) return `${typeLabel}: завершён вами`;
        if (payload?.endedBy) return `${typeLabel}: завершён собеседником`;
        return `${typeLabel}: завершён`;
    }

    return "";
}

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

        const requestUsers = () => {
            socket.emit("users:get");
        };

        const onUsers = (users) => {
            console.log("📥 users from socket:", users);
            dispatch({ type: "SET_USERS", payload: users });
        };

        socket.on("users:list", onUsers);
        socket.on("connect", requestUsers);
        socket.on("auth:success", requestUsers);
        requestUsers();

        return () => {
            socket.off("users:list", onUsers);
            socket.off("connect", requestUsers);
            socket.off("auth:success", requestUsers);
        };
    }, [currentUser?.id, dispatch]);

    // --- OPEN CHAT (PRIVATE + GROUP) ---
    // ✅ Для групп тоже запрашиваем chat:open, чтобы получать серверную историю
    // (важно для офлайн-пользователей, которые не получали message:new в момент публикации).
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        if (!currentUser?.id || !activeChatUserId) return;

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

         // Важно: подписываемся ДО emit, чтобы не словить race-condition
        // (сервер может ответить chat:opened очень быстро).
        socket.on("chat:opened", onChatOpened);

        socket.emit("chat:open", {
            from: currentUser.id,
            to: activeChatUserId,
        });


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
                dispatch({
                    type: "CHAT_HISTORY_NOTICE",
                    payload: { chatId: activeChatId ?? null, message },
                });

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
                dispatch({
                    type: "CHAT_HISTORY_NOTICE",
                    payload: { chatId: chatId ?? activeChatId ?? null, message: reason },
                });

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

    // --- CALL LIFECYCLE NOTICES ---
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        if (!currentUser?.id || !activeChatId) return;

        const emitNoticeIfActiveChat = (eventName) => (payload = {}) => {
            if (payload?.chatId !== activeChatId) return;
            const text = formatCallNotice(eventName, payload, currentUser.id);
            if (!text) return;

            dispatch({
                type: "CHAT_HISTORY_NOTICE",
                payload: {
                    chatId: activeChatId,
                    message: text,
                },
            });
        };

        const onIncoming = emitNoticeIfActiveChat("call:incoming");
        const onRinging = emitNoticeIfActiveChat("call:ringing");
        const onAccepted = emitNoticeIfActiveChat("call:accepted");
        const onDeclined = emitNoticeIfActiveChat("call:declined");
        const onEnded = emitNoticeIfActiveChat("call:ended");

        socket.on("call:incoming", onIncoming);
        socket.on("call:ringing", onRinging);
        socket.on("call:accepted", onAccepted);
        socket.on("call:declined", onDeclined);
        socket.on("call:ended", onEnded);

        return () => {
            socket.off("call:incoming", onIncoming);
            socket.off("call:ringing", onRinging);
            socket.off("call:accepted", onAccepted);
            socket.off("call:declined", onDeclined);
            socket.off("call:ended", onEnded);
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