import { useEffect, useMemo, useReducer, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { chatReducer, initialState } from "./chatReducer";
import { useChatSocket } from "./hooks/useChatSocket";
import { useAdvertisementGroupSummaries } from "./hooks/useAdvertisementGroupSummaries";
import DialogList from "./components/DialogList";
import ChatWindow from "./components/ChatWindow";
import { connectSocket, getSocket } from "../../shared/socket";
import { useUserBlocks } from "../../shared/useUserBlocks";
import { announceActiveChat } from "../../shared/messengerNotifications";

import "./chat.css";
import "../../styles/variables.css";

function getPrivateChatId(userA, userB) {
    return `room-${[userA, userB].sort().join("-")}`;
}

export default function Chat({ currentUser }) {
    const location = useLocation();
    const navigate = useNavigate();
    const [state, dispatch] = useReducer(chatReducer, {
        ...initialState,
        activeChatUserId: null,
        chats: {},
    });

    const { users, chats, activeChatUserId, activeChatId } = state;
    const requestedCallRef = useRef("");
    const { blockedIds, block, unblock } = useUserBlocks(currentUser.id);
    const advertisementSummaries = useAdvertisementGroupSummaries({
        currentUserId: currentUser.id,
        activeGroupId: activeChatUserId?.startsWith("group-") ? activeChatUserId : null,
    });
    const userToOpen = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get("user");
    }, [location.search]);
    const requestedCallType = useMemo(() => {
        const value = new URLSearchParams(location.search).get("call");
        return value === "audio" || value === "video" ? value : null;
    }, [location.search]);

    useEffect(() => {
        if (!userToOpen || userToOpen === currentUser.id) return;
        if (activeChatUserId === userToOpen) return;

        const existsInUsers = users.some((user) => user.id === userToOpen);
        if (!existsInUsers && !userToOpen.startsWith("group-")) return;

        dispatch({ type: "SET_ACTIVE_CHAT_USER", payload: userToOpen });

        // Важно: query-параметр ?user= используем только для первичного открытия.
        // После этого убираем его, чтобы ручной выбор в списке чатов не перезаписывался.
        navigate(requestedCallType ? `/chat?call=${requestedCallType}` : "/chat", { replace: true, state: location.state });
    }, [activeChatUserId, currentUser.id, location.state, navigate, requestedCallType, userToOpen, users]);

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

    useEffect(() => {
        announceActiveChat(resolvedChatId);
        return () => announceActiveChat(null);
    }, [resolvedChatId]);

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
        const hasAudioAttachment = normalizedAttachments.some((item) => item.mediaType === "audio");
        const hasImageAttachment = normalizedAttachments.some((item) => item.mediaType === "image");
        const hasAnyAttachment = hasAttachments;

        // защита от совсем пустого
        if (!cleanText.trim() && !hasAnyImage && !hasAttachments) return;

        // контракт: media сообщения отправляем через attachments; для voice текст пустой
        const normalizedText = hasAudioAttachment ? "" : cleanText;
        const normalizedType = hasAnyAttachment ? "media" : (type ?? (hasAttachments ? "media" : "text"));
        const normalizedImageUrl = hasImageAttachment ? null : (imageUrl ?? null);
        const normalizedImageUrls = hasImageAttachment ? undefined : (Array.isArray(imageUrls) ? imageUrls : undefined);

        const message = {
            id: crypto.randomUUID(),
            chatId: resolvedChatId,
            text: normalizedText,
            imageUrl: normalizedImageUrl,
            imageUrls: normalizedImageUrls,
            type: normalizedType,
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

    const startCallFromChat = (type) => {
        if (!resolvedChatId) return;
        if (!activeChatUserId || activeChatUserId.startsWith("group-")) return;

        const socket = connectSocket();
        if (!socket) return;

        socket.emit("call:start", {
            chatId: resolvedChatId,
            type,
            targetUserId: activeChatUserId,
        });
    };

    const deletePrivateChat = () => {
        if (!resolvedChatId || activeChat?.type !== "private") return;
        if (!window.confirm("Удалить этот чат только у вас? История до этого момента больше не будет показана.")) return;

        getSocket()?.emit("chat:delete", { chatId: resolvedChatId });
    };

    const blockActiveContact = async () => {
        if (!activeUser?.id || activeChat?.type !== "private") return;
        if (!window.confirm("Добавить пользователя в чёрный список? Личные сообщения и звонки станут недоступны.")) return;
        await block(activeUser.id);
        dispatch({ type: "DELETE_PRIVATE_CHAT", payload: { chatId: resolvedChatId } });
    };

    useEffect(() => {
        if (!requestedCallType || !resolvedChatId || !activeChatUserId || activeChatUserId.startsWith("group-")) return;
        const requestKey = `${activeChatUserId}:${requestedCallType}`;
        if (requestedCallRef.current === requestKey) return;
        requestedCallRef.current = requestKey;
        startCallFromChat(requestedCallType);
        navigate("/chat", { replace: true });
    }, [activeChatUserId, navigate, requestedCallType, resolvedChatId]);

    return (
        <div className="chat-main">
            <DialogList
                className={activeChatUserId ? "hidden-mobile" : ""}
                currentUserId={currentUser.id}
                users={users.filter((user) => user.id !== currentUser.id)}
                blockedIds={blockedIds}
                chats={chats}
                advertisementSummaries={advertisementSummaries}
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
                onStartCall={startCallFromChat}
                onDeleteChat={deletePrivateChat}
                isContactBlocked={Boolean(activeUser?.id && blockedIds.has(activeUser.id))}
                onBlockContact={blockActiveContact}
                onUnblockContact={() => activeUser?.id && unblock(activeUser.id)}
                initialCall={location.state?.acceptedCall ?? null}
            />

        </div>
    );
}
