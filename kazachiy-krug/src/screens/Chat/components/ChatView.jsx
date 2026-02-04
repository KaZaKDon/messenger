import { useEffect, useMemo, useRef } from "react";
import { getSocket } from "../../../shared/socket";
import MessageInput from "./MessageInput";

export default function ChatView({
    chat,
    currentUserId,
    onSend,
    onDraftChange,
    onTyping,
    onStopTyping
}) {
    const chatId = chat?.id;

    const messages = useMemo(() => {
        return chat?.messages ?? [];
    }, [chat]);

    const typingUsers = chat?.typingUsers ?? [];
    const title = chat?.title ?? "";
    const type = chat?.type ?? "private";

    /**
     * 📌 READ:
     * Когда пользователь находится в чате —
     * все доставленные чужие сообщения считаем прочитанными
     */
    const readSentRef = useRef(new Set());

    useEffect(() => {
    if (!chatId || !currentUserId) return;

    const socket = getSocket();
    if (!socket) return;

    messages.forEach(msg => {
        if (
            msg.senderId !== currentUserId &&
            msg.status === "delivered" &&
            !readSentRef.current.has(msg.id) &&
            document.hasFocus()
        ) {
            readSentRef.current.add(msg.id);

            socket.emit("message:read", {
                chatId,
                messageId: msg.id
            });

            console.log("EMIT READ:", chatId, msg.id);
        }
    });
}, [chatId, messages, currentUserId]);

    if (!chat) {
        return (
            <main className="chat-view chat-empty">
                <div className="chat-placeholder">Выберите чат</div>
            </main>
        );
    }

    return (
        <main className="chat-view">
            <header className="chat-header">
                <h2>{title}</h2>

                {typingUsers.length > 0 && (
                    <span className="typing">
                        {typingUsers.map(u => u.name).join(", ")} печатает…
                    </span>
                )}
            </header>

            <div className="messages">
                {messages.map(msg => {
                    const isMe = msg.senderId === currentUserId;

                    console.log("🖥️ RENDER MESSAGE", {
                        currentUserId,
                        senderId: msg.senderId,
                        isMe,
                        id: msg.id
                    });

                    return (
                        <div
                            key={msg.id}
                            className={`message ${isMe ? "outgoing" : "incoming"}`}
                        >
                            {!isMe && type === "group" && (
                                <div className="message-author">
                                    {msg.senderName}
                                </div>
                            )}

                            <div className="message-text">
                                {msg.text}
                            </div>

                            {isMe && msg.status && (
                                <div className={`message-status ${msg.status}`}>
                                    {msg.status === "sent" && "✓"}
                                    {(msg.status === "delivered" || msg.status === "read") && "✓✓"}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <MessageInput
                chat={chat}
                onSend={onSend}
                onDraftChange={onDraftChange}
                onTyping={onTyping}
                onStopTyping={onStopTyping}
            />
        </main>
    );
}