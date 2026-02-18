import { useMemo } from "react";

function formatTime(ts) {
    if (!ts) return "";
    try {
        return new Date(ts).toLocaleString([], {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "";
    }
}

export default function AnnouncementCard({
    message,
    currentUserId,
    onWriteToAuthor,
}) {
    const isMe = message?.senderId === currentUserId;

    const imageUrls = useMemo(() => {
        if (!message) return [];
        if (Array.isArray(message.imageUrls)) return message.imageUrls.filter(Boolean);
        if (typeof message.imageUrl === "string" && message.imageUrl.trim()) return [message.imageUrl.trim()];
        return [];
    }, [message]);

    const authorName = message?.senderName ?? "Автор";
    const createdAt = formatTime(message?.createdAt);

    return (
        <div className={`announce-card ${isMe ? "mine" : "other"}`}>
            <div className="announce-card-head">
                <div className="announce-card-author">{authorName}</div>
                {createdAt ? <div className="announce-card-time">{createdAt}</div> : null}
            </div>

            {imageUrls.length ? (
                <div className="announce-card-images">
                    {imageUrls.map((u) => (
                        <img key={u} className="announce-card-image" src={u} alt="" />
                    ))}
                </div>
            ) : null}

            {message?.text ? (
                <div className="announce-card-text">{message.text}</div>
            ) : null}

            {/* ✅ Кнопка только для НЕ автора */}
            {!isMe && message?.senderId ? (
                <div className="announce-card-actions">
                    <button
                        type="button"
                        className="announce-card-btn"
                        onClick={() => onWriteToAuthor?.(message.senderId)}
                    >
                        Написать автору
                    </button>
                </div>
            ) : null}
        </div>
    );
}