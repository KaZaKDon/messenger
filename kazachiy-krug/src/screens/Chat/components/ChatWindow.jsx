import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import AnnouncementComposer from "./AnnouncementComposer";
import AnnouncementCard from "./AnnouncementCard";

const API_BASE = "http://localhost:3000";

export default function ChatWindow({
    chat,
    activeUser,
    hasSelectedChat,
    currentUserId,
    onSend,
    onDraftChange,
    onTypingStart,
    onTypingStop,
    onWriteToAuthor, // ✅ новый колбэк
    className = "",
    onBackToList,

}) {
    const endRef = useRef(null);
    const typingRef = useRef(false);
    const stopTypingTimeout = useRef(null);

    // ✅ emoji UI
    const [emojiOpen, setEmojiOpen] = useState(false);

    // ✅ режим для групп 4–10: FEED (по умолчанию) / CREATE (форма)
    const [announcementMode, setAnnouncementMode] = useState("feed"); // "feed" | "create"

    useEffect(() => {
        // при смене чата всегда возвращаемся на ленту
        setAnnouncementMode("feed");
    }, [chat?.id]);

    const emojiList = useMemo(
        () => [
            "😀", "😂", "😍", "😎", "😭", "😡",
            "👍", "👎", "🙏", "❤️", "🔥", "✨",
            "✅", "🎉", "🤝", "💬",
        ],
        []
    );

    const insertEmoji = useCallback(
        (e) => {
            if (!chat) return;
            const next = (chat.draft ?? "") + e;
            onDraftChange?.(next);
            setEmojiOpen(false);
        },
        [chat, onDraftChange]
    );

    // ✅ image upload UI (обычный чат)
    const fileInputRef = useRef(null);
    const [selectedImageFile, setSelectedImageFile] = useState(null);
    const [selectedImagePreview, setSelectedImagePreview] = useState(null);
    const [uploading, setUploading] = useState(false);

    const clearSelectedImage = useCallback(() => {
        setSelectedImageFile(null);
        setSelectedImagePreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
    }, []);

    const onPickImage = useCallback(
        (event) => {
            const file = event.target.files?.[0];
            if (!file) return;

            if (!file.type?.startsWith("image/")) return;

            if (file.size > 5 * 1024 * 1024) {
                alert("Файл слишком большой. Максимум 5MB.");
                return;
            }

            event.target.value = "";

            clearSelectedImage();
            setSelectedImageFile(file);
            setSelectedImagePreview(URL.createObjectURL(file));
        },
        [clearSelectedImage]
    );

    async function uploadSelectedImage() {
        if (!selectedImageFile) return null;

        const fd = new FormData();
        fd.append("image", selectedImageFile);

        setUploading(true);
        try {
            const res = await fetch(`${API_BASE}/upload`, {
                method: "POST",
                body: fd,
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "Upload failed");
            }

            const data = await res.json();
            return data?.imageUrl ?? null;
        } finally {
            setUploading(false);
        }
    }

    useEffect(() => {
        if (!endRef.current) return;
        endRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
    }, [chat?.messages?.length, announcementMode]);

    const stopTypingNow = useCallback(() => {
        if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current);

        if (typingRef.current) {
            typingRef.current = false;
            onTypingStop?.();
        }
    }, [onTypingStop]);

    useEffect(() => {
        const handleWindowBlur = () => stopTypingNow();
        window.addEventListener("blur", handleWindowBlur);

        return () => {
            window.removeEventListener("blur", handleWindowBlur);
            stopTypingNow();
        };
    }, [stopTypingNow]);

    useEffect(() => {
        stopTypingNow();
        setEmojiOpen(false);
    }, [chat?.id, stopTypingNow]);

    const handleChange = (event) => {
        const value = event.target.value;
        onDraftChange?.(value);

        if (!chat) return;

        if (!value.trim()) {
            stopTypingNow();
            return;
        }

        if (!typingRef.current) {
            typingRef.current = true;
            onTypingStart?.();
        }

        if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current);
        stopTypingTimeout.current = setTimeout(stopTypingNow, 1200);
    };

    const handleSend = async () => {
        if (!chat) return;

        const text = (chat.draft ?? "").trim();
        if (!text && !selectedImageFile) return;

        let imageUrl = null;

        try {
            if (selectedImageFile) {
                imageUrl = await uploadSelectedImage();
                if (!imageUrl) {
                    alert("Не удалось загрузить картинку.");
                    return;
                }
            }

            if (imageUrl?.startsWith("blob:")) {
                alert("Картинка не загрузилась на сервер. Повтори отправку.");
                return;
            }

            onSend({ text, imageUrl });

            onDraftChange?.("");
            stopTypingNow();
            setEmojiOpen(false);
            clearSelectedImage();
        } catch (err) {
            console.error(err);
            alert("Ошибка при отправке. Проверь сервер /upload.");
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };

    const chatType = chat?.type ?? "private";

    // ✅ круги-объявления: по id
    const isAnnouncementGroup =
        typeof chat?.id === "string" && /^group-(?:[4-9]|10)$/.test(chat.id);

        const canPublish = chat?.canPublish !== false;

    // ✅ phone: берём из activeUser, если нет — из chat.otherUser (новый payload с сервера)
    const otherPhone =
        activeUser?.phone ??
        chat?.otherUser?.phone ??
        null;

    const onlineCount = hasSelectedChat
        ? chatType === "group"
            ? chat?.onlineCount ?? 0
            : activeUser?.isOnline
                ? 1
                : 0
        : 0;

    const subtitle = hasSelectedChat
        ? chatType === "private"
            ? (otherPhone ? otherPhone : (activeUser?.isOnline ? "в сети" : "не в сети"))
            : `${onlineCount} онлайн`
        : "чат не выбран";

    return (
        <section className={`chat-window ${className}`.trim()}>
            <header className="chat-header">
                <div className="chat-header-main">
                    <button
                        type="button"
                        className="chat-back-btn"
                        onClick={onBackToList}
                        aria-label="Назад к списку кругов"
                    >
                        ←
                    </button>

                    <div className="chat-avatar" aria-hidden="true" />
                    <div className="chat-header-text">
                        <h2>{hasSelectedChat ? activeUser?.name ?? "Чат" : "Чат не выбран"}</h2>
                        <span className="chat-type">{subtitle}</span>
                    </div>
                </div>
                <div className="chat-header-actions">
                    <button type="button" aria-label="search">⌕</button>
                    <button type="button" aria-label="menu">⋯</button>
                </div>
            </header>

            {chat?.typingUsers?.length ? <span className="chat-typing">печатает...</span> : null}

            {/* =======================
            ГРУППЫ 4–10 (ОБЪЯВЛЕНИЯ)
         ======================= */}
            {isAnnouncementGroup ? (
                <>
                    {/* FEED */}
                    {announcementMode === "feed" ? (
                        <>
                            <div className="messages">
                                {!hasSelectedChat ? (
                                    <div className="chat-empty-placeholder">
                                        Выберите круг слева, чтобы посмотреть объявления
                                    </div>
                                ) : null}

                                {chat?.messages?.map((m) => (
                                    <AnnouncementCard
                                        key={m.id}
                                        message={m}
                                        currentUserId={currentUserId}
                                        onWriteToAuthor={onWriteToAuthor}
                                    />
                                ))}

                                <div ref={endRef} />
                            </div>

                            {/* CTA снизу */}
                            <div className="announce-cta">
                                <button
                                    type="button"
                                    className="announce-cta-btn"
                                    disabled={!chat || !hasSelectedChat || !canPublish}
                                    onClick={() => setAnnouncementMode("create")}
                                >
                                    + Разместить объявление
                                </button>
                            </div>

                            {!canPublish ? (
                                <div className="chat-empty-placeholder">
                                    У вас нет прав на публикацию в этой группе.
                                </div>
                            ) : null}

                        </>
                    ) : (
                        /* CREATE */
                        <div className="announce-screen">
                            <div className="announce-screen-top">
                                <button
                                    type="button"
                                    className="announce-back"
                                    onClick={() => setAnnouncementMode("feed")}
                                >
                                    ← Назад к объявлениям
                                </button>
                            </div>

                            <AnnouncementComposer
                                disabled={!chat || !hasSelectedChat || !canPublish}
                                onSubmit={({ text, imageUrls }) => {
                                    onSend({ text, imageUrls });
                                    setAnnouncementMode("feed");
                                }}
                            />
                        </div>
                    )}
                </>
            ) : (
                /* =======================
                   ОБЫЧНЫЕ ЧАТЫ (ЛИЧКА + ПОБОЛТАЕМ)
                   ======================= */
                <>
                    <div className="messages">
                        {!hasSelectedChat ? (
                            <div className="chat-empty-placeholder">
                                Выберите контакт слева, чтобы начать диалог
                            </div>
                        ) : null}

                        {chat?.messages?.map((m) => {
                            const hasSender = Boolean(m.senderId);
                            const isMe = hasSender ? m.senderId === currentUserId : m.fromMe === true;

                            return (
                                <div key={m.id} className={`message ${isMe ? "outgoing" : "incoming"}`}>
                                    <div className="bubble">
                                        {(() => {
                                            const urls = Array.isArray(m.imageUrls)
                                                ? m.imageUrls
                                                : (m.imageUrl ? [m.imageUrl] : []);

                                            return urls.length ? (
                                                <div className="message-images">
                                                    {urls.map((u) => (
                                                        <img key={u} className="message-image" src={u} alt="" />
                                                    ))}
                                                </div>
                                            ) : null;
                                        })()}

                                        {m.text ? <div className="message-text">{m.text}</div> : null}
                                    </div>

                                    {isMe && m.status && (
                                        <div className={`message-status ${m.status}`}>
                                            {m.status === "sent" && "✓"}
                                            {(m.status === "delivered" || m.status === "read") && "✓✓"}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <div ref={endRef} />
                    </div>

                    {/* превью для обычного чата */}
                    {selectedImagePreview ? (
                        <div className="draft-preview">
                            <img src={selectedImagePreview} alt="" />
                            <button
                                type="button"
                                className="draft-preview-remove"
                                onClick={clearSelectedImage}
                                disabled={uploading}
                                aria-label="remove image"
                            >
                                ✕
                            </button>
                        </div>
                    ) : null}

                    <footer className="chat-input">
                        <div className="chat-input-left">
                            <button
                                type="button"
                                className="attach-btn"
                                aria-label="attach"
                                disabled={!chat || !hasSelectedChat || uploading || !canPublish}
                                onClick={() => fileInputRef.current?.click()}
                                title="Прикрепить картинку"
                            >
                                📎
                            </button>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={onPickImage}
                            />

                            <button
                                type="button"
                                className="emoji-btn"
                                aria-label="emoji"
                                disabled={!chat || !hasSelectedChat || uploading || !canPublish}
                                onClick={() => setEmojiOpen((v) => !v)}
                                title="Смайлики"
                            >
                                🙂
                            </button>

                            {emojiOpen ? (
                                <div className="emoji-panel" role="dialog" aria-label="emoji panel">
                                    {emojiList.map((e) => (
                                        <button
                                            type="button"
                                            key={e}
                                            className="emoji-item"
                                            onClick={() => insertEmoji(e)}
                                        >
                                            {e}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>

                        <textarea
                            value={chat?.draft ?? ""}
                            disabled={!chat || !hasSelectedChat || uploading || !canPublish}
                            onChange={handleChange}
                            onBlur={stopTypingNow}
                            onKeyDown={handleKeyDown}
                            placeholder={canPublish ? (uploading ? "Загрузка..." : "Сообщение...") : "Публикация в этой группе запрещена"}
                            rows={1}
                        />

                        <button
                            disabled={!chat || !hasSelectedChat || uploading || !canPublish}
                            onClick={handleSend}
                            title="Отправить"
                        >
                            ➤
                        </button>
                    </footer>
                </>
            )}
        </section>
    );
}