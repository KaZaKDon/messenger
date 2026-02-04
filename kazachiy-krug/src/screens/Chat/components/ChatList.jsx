import { useMemo } from "react";

export default function ChatList({
    chats,
    activeChatId,
    onSelect,
    onNewChat,
    onNewGroup,
    onTogglePin,
    onToggleMute
}) {
    const sortedChats = useMemo(() => {
        return [...chats].sort((a, b) => {
            // 1️⃣ pinned
            if (a.pinned !== b.pinned) {
                return a.pinned ? -1 : 1;
            }

            // 2️⃣ unread
            if (a.unread !== b.unread) {
                return b.unread - a.unread;
            }

            // 3️⃣ last message time
            if (!a.lastMessageAt && !b.lastMessageAt) return 0;
            if (!a.lastMessageAt) return 1;
            if (!b.lastMessageAt) return -1;

            return b.lastMessageAt - a.lastMessageAt;
        });
    }, [chats]);

    return (
        <aside className="chat-list">

            <header className="chat-list-header">
                <h2>Чаты</h2>

                <div className="chat-list-actions">
                    <button onClick={onNewChat}>+ Чат</button>
                    <button onClick={onNewGroup}>+ Группа</button>
                </div>
            </header>

            <ul className="chat-items">
                {sortedChats.length === 0 && (
                    <li className="chat-empty">Чатов пока нет</li>
                )}

                {sortedChats.map(chat => (
                    <li
                        key={chat.id}
                        className={`chat-item ${chat.id === activeChatId ? "active" : ""}`}
                        onClick={() => onSelect(chat.id)}
                    >
                        <div className="chat-item-main">
                            <div className="chat-item-top">
                                <span className="chat-title">
                                    {chat.pinned && "📌 "}
                                    {chat.title}
                                </span>

                                {chat.lastMessageAt && (
                                    <span className="chat-time">
                                        {new Date(chat.lastMessageAt).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit"
                                        })}
                                    </span>
                                )}
                            </div>

                            <div className="chat-preview">
                                {chat.lastMessage || "Нет сообщений"}
                            </div>
                        </div>

                        <div className="chat-item-actions">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTogglePin(chat.id);
                                }}
                            >
                                {chat.pinned ? "Unpin" : "Pin"}
                            </button>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleMute(chat.id);
                                }}
                            >
                                {chat.muted ? "🔕" : "🔔"}
                            </button>

                            {chat.unread > 0 && (
                                <span className="chat-unread">{chat.unread}</span>
                            )}
                        </div>
                    </li>
                ))}
            </ul>

        </aside>
    );
}