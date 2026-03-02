import { useMemo, useReducer } from "react";
import { chatReducer, initialState } from "./chatReducer";
import { useChatSocket } from "./hooks/useChatSocket";
import DialogList from "./components/DialogList";
import ChatWindow from "./components/ChatWindow";
import { getSocket } from "../../shared/socket";

import "./chat.css";
import "../../styles/variables.css";

export default function Chat({ currentUser }) {
    const [state, dispatch] = useReducer(chatReducer, {
        ...initialState,
        activeChatUserId: null,
        chats: {},
    });

    const { users, chats, activeChatUserId, activeChatId } = state;

    const activeChat = activeChatId ? chats[activeChatId] : null;

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

    const sendMessage = ({ text, imageUrl, imageUrls }) => {
        if (!activeChatId) return;

        const socket = getSocket();
        if (!socket) return;

        const cleanText = (text ?? "").toString();
        const hasAnyImage =
            typeof imageUrl === "string"
                ? imageUrl.trim().length > 0
                : Array.isArray(imageUrls) && imageUrls.filter(Boolean).length > 0;

        // защита от совсем пустого
        if (!cleanText.trim() && !hasAnyImage) return;

        const message = {
            id: crypto.randomUUID(),
            chatId: activeChatId,
            text: cleanText,
            imageUrl: imageUrl ?? null,
            imageUrls: Array.isArray(imageUrls) ? imageUrls : undefined,
            senderId: currentUser.id,
            fromMe: true,
            status: "sent",
        };

        socket.emit("message:send", message);

        dispatch({
            type: "RECEIVE_MESSAGE",
            payload: { chatId: activeChatId, message },
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
                        if (!activeChatId) return;

                        dispatch({
                            type: "SET_DRAFT",
                            payload: { chatId: activeChatId, text },
                        });
                    }}
                    onTypingStart={startTyping}
                    onTypingStop={stopTyping}
                    onLoadOlderMessages={loadOlderMessages}
                />

        </div>
    );
}