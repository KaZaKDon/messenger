import { useMemo, useState } from "react";
import { API_BASE_URL } from "../../../shared/config";
import ComplaintDialog from "./ComplaintDialog";

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

function imageSource(url) {
    if (!url || url.startsWith("http")) return url;
    return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export default function AnnouncementCard({
    advertisement,
    currentUserId,
    onWriteToAuthor,
}) {
    const isMe = advertisement?.authorId === currentUserId;
    const [complaintOpen, setComplaintOpen] = useState(false);
    const [complaintSent, setComplaintSent] = useState(false);

    const imageUrls = useMemo(() => {
        return Array.isArray(advertisement?.images)
            ? advertisement.images.map((image) => image?.url).filter(Boolean)
            : [];
    }, [advertisement]);

    const authorName = advertisement?.author?.name ?? "Автор";
    const createdAt = formatTime(advertisement?.publishedAt);

    return (
        <div className={`announce-card ${isMe ? "mine" : "other"}`}>
            <div className="announce-card-head">
                <div className="announce-card-author">{authorName}</div>
                {createdAt ? <div className="announce-card-time">{createdAt}</div> : null}
            </div>

            {imageUrls.length ? (
                <div className="announce-card-images">
                    {imageUrls.map((u) => (
                        <img key={u} className="announce-card-image" src={imageSource(u)} alt="" />
                    ))}
                </div>
            ) : null}

            <div className="announce-card-text">
                <strong>{advertisement?.title}</strong>
                <div>{advertisement?.settlement}{advertisement?.price ? ` • ${advertisement.price}` : ""}</div>
                <div>{advertisement?.description}</div>
            </div>

            {/* ✅ Кнопка только для НЕ автора */}
            {!isMe && advertisement?.authorId ? (
                <div className="announce-card-actions">
                    <button
                        type="button"
                        className="announce-card-btn"
                        onClick={() => onWriteToAuthor?.(advertisement.authorId)}
                    >
                        Написать автору
                    </button>
                    {advertisement?.author?.phone ? <a className="announce-card-btn" href={`tel:${advertisement.author.phone}`}>Позвонить</a> : null}
                    <button type="button" className="announce-card-btn secondary" disabled={complaintSent} onClick={() => setComplaintOpen(true)}>
                        {complaintSent ? "Жалоба отправлена" : "Пожаловаться"}
                    </button>
                </div>
            ) : null}
            {complaintOpen ? (
                <ComplaintDialog
                    advertisement={advertisement}
                    onClose={() => setComplaintOpen(false)}
                    onSent={() => { setComplaintSent(true); setComplaintOpen(false); }}
                />
            ) : null}
        </div>
    );
}
