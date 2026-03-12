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

const VOICE_MIME_CANDIDATES = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
];

function getSupportedVoiceMimeType() {
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
        return "";
    }

    return VOICE_MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function formatVoiceDuration(totalMs) {
    const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
}


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
    onLoadOlderMessages,
    className = "",
    onBackToList,

}) {
    const endRef = useRef(null);
    const typingRef = useRef(false);
    const stopTypingTimeout = useRef(null);
    const autoLoadThrottleRef = useRef(0);
    const prevMessagesMetaRef = useRef({
        chatId: null,
        firstId: null,
        lastId: null,
        length: 0,
    });

    // ✅ emoji UI
    const [emojiOpen, setEmojiOpen] = useState(false);

    // ✅ режим для групп 4–10: FEED (по умолчанию) / CREATE (форма)
    const [announcementMode, setAnnouncementMode] = useState("feed"); // "feed" | "create"

    useEffect(() => {
        // при смене чата всегда возвращаемся на ленту
        setAnnouncementMode("feed");
    }, [chat?.id]);

    const hasMoreHistory = Boolean(chat?.hasMoreHistory);
    const historyLoading = Boolean(chat?.historyLoading);
    const historyNotice = chat?.historyNotice ?? "";

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

    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const voiceChunksRef = useRef([]);
    const voiceStartedAtRef = useRef(0);
    const voiceTimerRef = useRef(null);

    const [isRecordingVoice, setIsRecordingVoice] = useState(false);
    const [voiceDurationMs, setVoiceDurationMs] = useState(0);
    const [recordedVoiceBlob, setRecordedVoiceBlob] = useState(null);

    const stopVoiceTimer = useCallback(() => {
        if (voiceTimerRef.current) {
            clearInterval(voiceTimerRef.current);
            voiceTimerRef.current = null;
        }
    }, []);

    const stopVoiceTracks = useCallback(() => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }
    }, []);

    const clearRecordedVoice = useCallback(() => {
        setRecordedVoiceBlob(null);
        setVoiceDurationMs(0);
    }, []);

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
        fd.append("file", selectedImageFile);

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
            return data?.imageUrl ?? data?.fileUrl ?? null;
        } finally {
            setUploading(false);
        }
    }

    async function uploadRecordedVoice(blob) {
        if (!blob) return null;

        const fd = new FormData();
        const ext = blob.type.includes("ogg") ? "ogg" : "webm";
        fd.append("file", blob, `voice-note.${ext}`);

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
            return data?.audioUrl ?? data?.fileUrl ?? null;
        } finally {
            setUploading(false);
        }
    }

    const startVoiceRecording = useCallback(async () => {
        if (isRecordingVoice || uploading) return;

        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
            alert("Запись голоса не поддерживается в этом браузере.");
            return;
        }

        try {
            clearSelectedImage();
            clearRecordedVoice();
            voiceChunksRef.current = [];
            setVoiceDurationMs(0);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const mimeType = getSupportedVoiceMimeType();
            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);

            mediaRecorderRef.current = recorder;
            recorder.ondataavailable = (event) => {
                if (event.data?.size > 0) {
                    voiceChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                stopVoiceTimer();
                stopVoiceTracks();

                const fallbackMime = mimeType || "audio/webm";
                const blob = new Blob(voiceChunksRef.current, { type: fallbackMime });
                if (blob.size > 0) {
                    setRecordedVoiceBlob(blob);
                }

                mediaRecorderRef.current = null;
                voiceChunksRef.current = [];
                setIsRecordingVoice(false);
            };

            recorder.start();
            setIsRecordingVoice(true);
            voiceStartedAtRef.current = Date.now();
            stopVoiceTimer();
            voiceTimerRef.current = setInterval(() => {
                setVoiceDurationMs(Date.now() - voiceStartedAtRef.current);
            }, 250);
        } catch (error) {
            console.error(error);
            stopVoiceTimer();
            stopVoiceTracks();
            setIsRecordingVoice(false);
            alert("Не удалось включить микрофон. Проверьте доступ к микрофону.");
        }
    }, [clearRecordedVoice, clearSelectedImage, isRecordingVoice, stopVoiceTimer, stopVoiceTracks, uploading]);

    const stopVoiceRecording = useCallback(() => {
        if (!isRecordingVoice) return;

        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            recorder.stop();
            return;
        }

        stopVoiceTimer();
        stopVoiceTracks();
        setIsRecordingVoice(false);
    }, [isRecordingVoice, stopVoiceTimer, stopVoiceTracks]);

    const cancelVoiceRecording = useCallback(() => {
        if (isRecordingVoice) {
            mediaRecorderRef.current?.stop();
        }

        stopVoiceTimer();
        stopVoiceTracks();
        setIsRecordingVoice(false);
        clearRecordedVoice();
        voiceChunksRef.current = [];
    }, [clearRecordedVoice, isRecordingVoice, stopVoiceTimer, stopVoiceTracks]);

    const handleMessagesScroll = useCallback(
        (event) => {
            if (!hasSelectedChat || !hasMoreHistory || historyLoading) return;

            if (event.currentTarget.scrollTop > 48) return;

            const now = Date.now();
            if (now - autoLoadThrottleRef.current < 500) return;
            autoLoadThrottleRef.current = now;

            onLoadOlderMessages?.();
        },
        [hasMoreHistory, hasSelectedChat, historyLoading, onLoadOlderMessages]
    );

    useEffect(() => {
        const messages = chat?.messages ?? [];
        const firstId = messages[0]?.id ?? null;
        const lastId = messages.length ? messages[messages.length - 1]?.id ?? null : null;

        const prev = prevMessagesMetaRef.current;
        const sameChat = prev.chatId === (chat?.id ?? null);
        const isHistoryPrepend =
            sameChat &&
            messages.length > prev.length &&
            firstId !== prev.firstId &&
            lastId === prev.lastId;

        if (!isHistoryPrepend && endRef.current) {
            endRef.current.scrollIntoView({ block: "end", behavior: "smooth" });
        }

        prevMessagesMetaRef.current = {
            chatId: chat?.id ?? null,
            firstId,
            lastId,
            length: messages.length,
        };
    }, [announcementMode, chat?.id, chat?.messages]);


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
        cancelVoiceRecording();
    }, [cancelVoiceRecording, chat?.id, stopTypingNow]);

    useEffect(() => () => {
        stopVoiceTimer();
        stopVoiceTracks();
    }, [stopVoiceTimer, stopVoiceTracks]);


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
        if (!chat || isRecordingVoice || recordedVoiceBlob) return;

        const text = (chat.draft ?? "").trim();
        const hasVoice = Boolean(recordedVoiceBlob);
        if (!text && !selectedImageFile && !hasVoice) return;

        let imageUrl = null;
        let audioUrl = null;

        try {
            // UX-ограничение: voice отправляем отдельным действием (без смешивания с картинкой)
            if (!hasVoice && selectedImageFile) {
                imageUrl = await uploadSelectedImage();
                if (!imageUrl) {
                    alert("Не удалось загрузить картинку.");
                    return;
                }
            }

            if (hasVoice) {
                audioUrl = await uploadRecordedVoice(recordedVoiceBlob);
                if (!audioUrl) {
                    alert("Не удалось загрузить голосовое сообщение.");
                    return;
                }
            }

            if (imageUrl?.startsWith("blob:") || audioUrl?.startsWith("blob:")) {
                alert("Файл не загрузился на сервер. Повтори отправку.");
                return;
            }

            if (audioUrl) {
                onSend({
                    text: "",
                    type: "media",
                    attachments: [
                        {
                            mediaType: "audio",
                            url: audioUrl,
                            mimeType: recordedVoiceBlob.type || "audio/webm",
                            sizeBytes: recordedVoiceBlob.size,
                            durationMs: voiceDurationMs,
                        },
                    ],
                });
            } else {
                onSend({ text, imageUrl });
            }

            onDraftChange?.("");
            stopTypingNow();
            setEmojiOpen(false);
            clearSelectedImage();
            clearRecordedVoice();
        } catch (err) {
            console.error(err);
            alert("Ошибка при отправке. Проверь сервер /upload.");
        }
    };

    const handleKeyDown = (event) => {
        if (isRecordingVoice) return;

        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };

    const chatType = chat?.type ?? "private";
    const canUseComposer = !isRecordingVoice;

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
                            <div className="messages" onScroll={handleMessagesScroll}>
                                {historyNotice ? <div className="history-notice">{historyNotice}</div> : null}

                                {hasSelectedChat && hasMoreHistory ? (
                                    <button
                                        type="button"
                                        className="history-load-more"
                                        onClick={onLoadOlderMessages}
                                        disabled={historyLoading}
                                    >
                                        {historyLoading ? "Загружаем..." : "Показать более ранние объявления"}
                                    </button>
                                ) : null}

                                {hasSelectedChat && !hasMoreHistory && chat?.messages?.length ? (
                                    <div className="history-end">Более ранних объявлений нет</div>
                                ) : null}


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
                    <div className="messages" onScroll={handleMessagesScroll}>
                        {historyNotice ? <div className="history-notice">{historyNotice}</div> : null}

                        {hasSelectedChat && hasMoreHistory ? (
                            <button
                                type="button"
                                className="history-load-more"
                                onClick={onLoadOlderMessages}
                                disabled={historyLoading}
                            >
                                {historyLoading ? "Загружаем..." : "Показать более ранние сообщения"}
                            </button>
                        ) : null}

                        {hasSelectedChat && !hasMoreHistory && chat?.messages?.length ? (
                            <div className="history-end">Более ранних сообщений нет</div>
                        ) : null}


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

                                         {Array.isArray(m.attachments)
                                            ? m.attachments
                                                .filter((attachment) => attachment?.mediaType === "audio" && attachment?.url)
                                                .map((attachment) => (
                                                    <audio
                                                        key={attachment.id ?? attachment.url}
                                                        className="message-audio"
                                                        controls
                                                        preload="metadata"
                                                        src={attachment.url}
                                                    />
                                                ))
                                            : null}


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

                    {isRecordingVoice || recordedVoiceBlob ? (
                        <div className="voice-recorder-bar">
                            <span className="voice-recorder-state">
                                {isRecordingVoice ? "● Запись" : "Голосовое готово"}
                            </span>
                            <span className="voice-recorder-time">{formatVoiceDuration(voiceDurationMs)}</span>
                            <button
                                type="button"
                                className="voice-cancel-btn"
                                onClick={cancelVoiceRecording}
                                disabled={uploading}
                            >
                                Отмена
                            </button>
                        </div>
                    ) : null}


                    <footer className="chat-input">
                        <div className="chat-input-left">
                            <button
                                type="button"
                                className="attach-btn"
                                aria-label="attach"
                                disabled={!chat || !hasSelectedChat || uploading || !canPublish || !canUseComposer}
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
                                className="mic-btn"
                                aria-label={isRecordingVoice ? "stop recording" : "start recording"}
                                disabled={!chat || !hasSelectedChat || uploading || !canPublish}
                                onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                                title={isRecordingVoice ? "Остановить запись" : "Записать голос"}
                            >
                                {isRecordingVoice ? "⏹" : "🎙"}
                            </button>


                            <button
                                type="button"
                                className="emoji-btn"
                                aria-label="emoji"
                                disabled={!chat || !hasSelectedChat || uploading || !canPublish || !canUseComposer}
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
                            disabled={!chat || !hasSelectedChat || uploading || !canPublish || !canUseComposer}
                            onChange={handleChange}
                            onBlur={stopTypingNow}
                            onKeyDown={handleKeyDown}
                            placeholder={canPublish ? (isRecordingVoice ? "Идёт запись голосового..." : (uploading ? "Загрузка..." : "Сообщение...")) : "Публикация в этой группе запрещена"}
                            rows={1}
                        />

                        <button
                            disabled={!chat || !hasSelectedChat || uploading || !canPublish || !canUseComposer}
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