import { useMemo, useState } from "react";

function isGroupId(id) {
    return typeof id === "string" && id.startsWith("group-");
}

function getGroupNumber(id) {
    // group-10 -> 10
    const num = Number(String(id).split("-")[1]);
    return Number.isFinite(num) ? num : Number.MAX_SAFE_INTEGER;
}

function getPrivateChatId(currentUserId, targetUserId) {
    return `room-${[currentUserId, targetUserId].sort().join("-")}`;
}

function formatTime(timestamp) {
    if (!timestamp) return "";

    return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function DialogList({
    currentUserId,
    users,
    chats,
    activeUserId,
    onSelect,
}) {
    const [query, setQuery] = useState("");

    const dialogItems = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        const items = users
            .filter((user) => {
                if (!normalizedQuery) return true;
                return user.name.toLowerCase().includes(normalizedQuery);
            })
            .map((user) => {
                const group = isGroupId(user.id);

                // ✅ ВАЖНО:
                // - для группы chatId = group-id
                // - для лички chatId = room-user-user
                const chatId = group ? user.id : getPrivateChatId(currentUserId, user.id);

                const chat = chats[chatId];
                const messages = chat?.messages ?? [];
                const lastMessage = messages[messages.length - 1] ?? null;

                const unread = messages.filter(
                    (message) =>
                        message.senderId !== currentUserId && message.status !== "read"
                ).length;

                return {
                    user,
                    chatId,
                    isGroup: group,
                    groupOrder: group ? getGroupNumber(user.id) : null,
                    lastText: lastMessage?.text ?? "Нет сообщений",
                    isEmpty: messages.length === 0,
                    lastMessageAt: lastMessage?.createdAt ?? 0,
                    lastTime: formatTime(lastMessage?.createdAt),
                    unread,
                };
            });

        return items.sort((a, b) => {
            // 1) Группы всегда сверху
            if (a.isGroup && !b.isGroup) return -1;
            if (!a.isGroup && b.isGroup) return 1;

            // 2) Обе группы — строго по номеру group-N
            if (a.isGroup && b.isGroup) {
                return (a.groupOrder ?? 0) - (b.groupOrder ?? 0);
            }

            // 3) Оба личных — твоя старая логика
            if (a.lastMessageAt !== b.lastMessageAt) {
                return b.lastMessageAt - a.lastMessageAt;
            }

            if (a.unread !== b.unread) return b.unread - a.unread;

            return a.user.name.localeCompare(b.user.name, "ru");
        });
    }, [chats, currentUserId, query, users]);

    return (
        <aside className="dialog-list">
            <div className="dialog-search">
                <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Поиск"
                />
                <button type="button">Поиск</button>
            </div>

            {dialogItems.map(({ user, unread, lastText, lastTime, isEmpty }) => (
                <div
                    key={user.id}
                    className={`dialog-card ${user.id === activeUserId ? "active" : ""} ${isEmpty ? "empty" : ""
                        }`}
                    onClick={() => onSelect(user.id)}
                >
                    <div className="dialog-card-top">
                        <div className="dialog-user">
                            <span
                                className={`user-status ${user.isOnline ? "online" : "offline"}`}
                            />
                            <span className="dialog-name">{user.name}</span>
                        </div>
                        <span className="dialog-time">{lastTime}</span>
                    </div>

                    <div className="dialog-card-bottom">
                        <span className="dialog-preview">{lastText}</span>
                        {isEmpty ? <span className="dialog-empty-badge">Пустой чат</span> : null}
                        {unread > 0 ? <span className="dialog-unread">{unread}</span> : null}
                    </div>
                </div>
            ))}

            {dialogItems.length === 0 ? (
                <div className="dialog-empty">Ничего не найдено</div>
            ) : null}
        </aside>
    );
}