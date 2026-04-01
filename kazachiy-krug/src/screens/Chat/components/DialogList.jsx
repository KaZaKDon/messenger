import { useMemo, useState } from "react";

function isGroupId(id) {
    return typeof id === "string" && id.startsWith("group-");
}

function getGroupNumber(id) {
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

function getPreviewText(lastMessage) {
    if (!lastMessage) return "";
    if (typeof lastMessage.text === "string" && lastMessage.text.trim()) return lastMessage.text;
    return "Вложение";
}

export default function DialogList({
    currentUserId,
    users,
    chats,
    activeUserId,
    onSelect,
    className = "",
}) {
    const [queryInput, setQueryInput] = useState("");
    const [query, setQuery] = useState("");

    const applySearch = () => {
        setQuery(queryInput.trim());
    };

    const dialogItems = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        const items = users
            .map((user) => {
                const group = isGroupId(user.id);
                const chatId = group ? user.id : getPrivateChatId(currentUserId, user.id);
                const chat = chats[chatId];
                const messages = chat?.messages ?? [];
                const lastMessage = messages[messages.length - 1] ?? null;

                // Требование: группы показываем всегда.
                // Контакты показываем только если в чате есть хотя бы одно сообщение.
                if (!group && messages.length === 0) return null;

                if (normalizedQuery && !user.name.toLowerCase().includes(normalizedQuery)) {
                    return null;
                }

                return {
                    key: user.id,
                    selectId: user.id,
                    name: user.name,
                    isOnline: Boolean(user.isOnline),
                    isGroup: group,
                    groupOrder: group ? getGroupNumber(user.id) : null,
                    lastText: getPreviewText(lastMessage),
                    lastMessageAt: lastMessage?.createdAt ?? 0,
                    lastTime: formatTime(lastMessage?.createdAt),
                    unread: messages.filter(
                        (message) => message.senderId !== currentUserId && message.status !== "read"
                    ).length,
                };
            })
            .filter(Boolean);

        return items.sort((a, b) => {
            if (a.isGroup && !b.isGroup) return -1;
            if (!a.isGroup && b.isGroup) return 1;

            if (a.isGroup && b.isGroup) {
                return (a.groupOrder ?? 0) - (b.groupOrder ?? 0);
            }

            if (a.lastMessageAt !== b.lastMessageAt) {
                return b.lastMessageAt - a.lastMessageAt;
            }

            if (a.unread !== b.unread) return b.unread - a.unread;

            return a.name.localeCompare(b.name, "ru");
        });
    }, [chats, currentUserId, query, users]);

    return (
        <aside className={`dialog-list ${className}`.trim()}>
            <div className="dialog-search">
                <input
                    type="text"
                    value={queryInput}
                    onChange={(event) => setQueryInput(event.target.value)}
                    placeholder="Поиск"
                    onKeyDown={(event) => {
                        if (event.key === "Enter") applySearch();
                    }}
                />
                <button type="button" onClick={applySearch}>Поиск</button>
            </div>

            {dialogItems.map(({ key, selectId, name, isOnline, unread, lastText, lastTime }) => (
                <div
                    key={key}
                    className={`dialog-card ${selectId === activeUserId ? "active" : ""}`}
                    onClick={() => onSelect(selectId)}
                >
                    <div className="dialog-card-top">
                        <div className="dialog-user">
                            <span
                                className={`user-status ${isOnline ? "online" : "offline"}`}
                            />
                            <span className="dialog-name">{name}</span>
                        </div>
                        <span className="dialog-time">{lastTime}</span>
                    </div>

                    <div className="dialog-card-bottom">
                        <span className="dialog-preview">{lastText || "Нет сообщений"}</span>
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