import { useMemo, useReducer } from "react";
import { chatReducer, initialState } from "./chatReducer";
import { useChatSocket } from "./hooks/useChatSocket";
import DialogList from "./components/DialogList";
import ChatWindow from "./components/ChatWindow";
import { getSocket } from "../../shared/socket";

import "./chat.css";
import "../../styles/variables.css";

function getPrivateChatId(userA, userB) {
    return `room-${[userA, userB].sort().join("-")}`;
}


export default function Chat({ currentUser }) {
    const [state, dispatch] = useReducer(chatReducer, {
        ...initialState,
        activeChatUserId: null,
        chats: {},
    });

    const { users, chats, activeChatUserId, activeChatId } = state;

    const resolvedChatId = useMemo(() => {
        if (activeChatId) return activeChatId;

        if (!activeChatUserId || activeChatUserId.startsWith("group-")) {
            return null;
        }

        return getPrivateChatId(currentUser.id, activeChatUserId);
    }, [activeChatId, activeChatUserId, currentUser.id]);

    const activeChat = useMemo(() => {
        if (!resolvedChatId) return null;

        return (
            chats[resolvedChatId] ?? {
                id: resolvedChatId,
                type: "private",
                messages: [],
                draft: "",
                canPublish: true,
            }
        );
    }, [chats, resolvedChatId]);

    // 🔹 сокет (всегда)
    useChatSocket(
        dispatch,
        currentUser,
        activeChatUserId,
        activeChatId,
        activeChat?.messages ?? []
    );

    // ✅ активный “пользователь/группа” для шапки
    // - обычно берём из users по activeChatUserId
    // - для лички дополнительно разрешаем fallback на chat.otherUser (приходит с сервера)
    const activeUser = useMemo(() => {
        if (!activeChatUserId) return null;

        const fromList = users.find((u) => u.id === activeChatUserId) ?? null;
        if (fromList) return fromList;

        // fallback: если это private chat и сервер прислал otherUser
        if (activeChat?.type === "private" && activeChat?.otherUser?.id) {
            return activeChat.otherUser;
        }

        return null;
    }, [activeChat?.otherUser, activeChat?.type, activeChatUserId, users]);

    const sendMessage = ({ text, imageUrl, imageUrls, type, attachments }) => {
        if (!resolvedChatId) return;

        const socket = getSocket();
        if (!socket) return;

        const cleanText = (text ?? "").toString();
        const hasAnyImage =
            typeof imageUrl === "string"
                ? imageUrl.trim().length > 0
                : Array.isArray(imageUrls) && imageUrls.filter(Boolean).length > 0;
        const normalizedAttachments = Array.isArray(attachments)
            ? attachments.filter((item) => item && typeof item.url === "string" && item.url.trim())
            : [];
        const hasAttachments = normalizedAttachments.length > 0;

        // защита от совсем пустого
        if (!cleanText.trim() && !hasAnyImage && !hasAttachments) return;

        const message = {
            id: crypto.randomUUID(),
            chatId: resolvedChatId,
            text: cleanText,
            imageUrl: imageUrl ?? null,
            imageUrls: Array.isArray(imageUrls) ? imageUrls : undefined,
            type: type ?? (hasAttachments ? "media" : "text"),
            attachments: hasAttachments ? normalizedAttachments : undefined,

            senderId: currentUser.id,
            fromMe: true,
            status: "sent",
        };

        socket.emit("message:send", message);

        dispatch({
            type: "RECEIVE_MESSAGE",
            payload: { chatId: resolvedChatId, message },
        });
    };

    const openPrivateChat = (userId) => {
        // не даём открыть “на себя”
        if (!userId || userId === currentUser.id) return;

        stopTyping();
        dispatch({ type: "SET_ACTIVE_CHAT_USER", payload: userId });
    };

    const startTyping = () => {
        if (!activeChatId) return;
        const socket = getSocket();
        if (!socket) return;

        socket.emit("typing:start", { chatId: activeChatId });
    };

    const stopTyping = () => {
        if (!activeChatId) return;
        const socket = getSocket();
        if (!socket) return;

        socket.emit("typing:stop", { chatId: activeChatId });
    };

    const loadOlderMessages = () => {
        if (!activeChatId || !activeChat) return;
        if (activeChat.historyLoading || !activeChat.hasMoreHistory) return;

        const oldestMessage = activeChat.messages?.[0];
        if (!oldestMessage?.createdAt) return;

        const socket = getSocket();
        if (!socket) return;

        dispatch({
            type: "CHAT_HISTORY_LOADING",
            payload: { chatId: activeChatId, loading: true },
        });

        socket.emit("chat:history", {
            chatId: activeChatId,
            beforeCreatedAt: oldestMessage.createdAt,
        });
    };

    return (
        <div className="chat-main">
            <DialogList
                className={activeChatUserId ? "hidden-mobile" : ""}
                currentUserId={currentUser.id}
                users={users.filter((user) => user.id !== currentUser.id)}
                chats={chats}
                activeUserId={activeChatUserId}
                onSelect={(userId) => {
                    stopTyping();

                    dispatch({
                        type: "SET_ACTIVE_CHAT_USER",
                        payload: userId,
                    });
                }}
            />

            <ChatWindow
                className={!activeChatUserId ? "hidden-mobile" : ""}
                onBackToList={() => {
                    stopTyping();
                    dispatch({ type: "SET_ACTIVE_CHAT_USER", payload: null });
                }}

                key={activeChatUserId ?? "no-chat"}
                chat={activeChat}
                activeUser={activeUser}
                hasSelectedChat={Boolean(activeChatUserId)}
                currentUserId={currentUser.id}
                onSend={sendMessage}
                onWriteToAuthor={openPrivateChat}
                onDraftChange={(text) => {
                    // ✅ не пишем draft в "никуда"
                    if (!resolvedChatId) return;

                    dispatch({
                        type: "SET_DRAFT",
                        payload: { chatId: resolvedChatId, text },
                    });
                }}
                onTypingStart={startTyping}
                onTypingStop={stopTyping}
                onLoadOlderMessages={loadOlderMessages}
            />

        </div>
    );
}