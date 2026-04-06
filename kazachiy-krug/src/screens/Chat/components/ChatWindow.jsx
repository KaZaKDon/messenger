import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import AnnouncementComposer from "./AnnouncementComposer";
import AnnouncementCard from "./AnnouncementCard";
import { getSocket } from "../../../shared/socket";

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

function formatCallDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
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
    onStartCall,
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
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    const [activeCall, setActiveCall] = useState(null);
    const [callOverlayError, setCallOverlayError] = useState("");
    const [callElapsedSec, setCallElapsedSec] = useState(0);

    // ✅ режим для групп 4–10: FEED (по умолчанию) / CREATE (форма)
    const [announcementMode, setAnnouncementMode] = useState("feed"); // "feed" | "create"

    useEffect(() => {
        // при смене чата всегда возвращаемся на ленту
        setAnnouncementMode("feed");
    }, [chat?.id]);

    useEffect(() => {
        if (!chat?.id || !currentUserId) {
            setActiveCall(null);
            setCallOverlayError("");
            return undefined;
        }

        const socket = getSocket();
        if (!socket) return undefined;

        const inCurrentChat = (payload = {}) => payload?.chatId === chat.id;

        const onStarted = (payload = {}) => {
            if (!inCurrentChat(payload)) return;
            setCallOverlayError("");
            setActiveCall({
                callId: payload.callId,
                chatId: payload.chatId,
                type: payload.type ?? "audio",
                status: payload.status ?? "initiated",
                direction: "outgoing",
                startedAt: null,
            });
        };

        const onIncoming = (payload = {}) => {
            if (!inCurrentChat(payload)) return;
            setCallOverlayError("");
            setActiveCall({
                callId: payload.callId,
                chatId: payload.chatId,
                type: payload.type ?? "audio",
                status: payload.status ?? "ringing",
                direction: "incoming",
                startedAt: null,
            });
        };

        const onRinging = (payload = {}) => {
            if (!inCurrentChat(payload)) return;
            setActiveCall((prev) => (prev?.callId === payload.callId
                ? { ...prev, status: payload.status ?? "ringing" }
                : prev));
        };

        const onAccepted = (payload = {}) => {
            if (!inCurrentChat(payload)) return;
            setActiveCall((prev) => (prev?.callId === payload.callId
                ? { ...prev, status: payload.status ?? "connected", startedAt: payload?.startedAt ?? new Date().toISOString() }
                : prev));
        };

        const onFinished = (payload = {}) => {
            if (!inCurrentChat(payload)) return;
            setActiveCall((prev) => (prev?.callId === payload.callId
                ? { ...prev, status: "ended" }
                : prev));

            setTimeout(() => {
                setActiveCall((prev) => (prev?.callId === payload.callId ? null : prev));
            }, 1500);
        };

        const onCallError = ({ chatId, message } = {}) => {
            if (chatId && chatId !== chat.id) return;
            setCallOverlayError(message ?? "Ошибка звонка");
        };

        socket.on("call:started", onStarted);
        socket.on("call:incoming", onIncoming);
        socket.on("call:ringing", onRinging);
        socket.on("call:accepted", onAccepted);
        socket.on("call:declined", onFinished);
        socket.on("call:ended", onFinished);
        socket.on("call:error", onCallError);

        return () => {
            socket.off("call:started", onStarted);
            socket.off("call:incoming", onIncoming);
            socket.off("call:ringing", onRinging);
            socket.off("call:accepted", onAccepted);
            socket.off("call:declined", onFinished);
            socket.off("call:ended", onFinished);
            socket.off("call:error", onCallError);
        };
    }, [chat?.id, currentUserId]);

    useEffect(() => {
        if (!activeCall || activeCall.status !== "connected") {
            setCallElapsedSec(0);
            return undefined;
        }

        const baseMs = activeCall.startedAt ? new Date(activeCall.startedAt).getTime() : Date.now();
        const tick = () => {
            const diff = Math.max(0, Date.now() - baseMs);
            setCallElapsedSec(Math.floor(diff / 1000));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [activeCall]);

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
    const voiceCancelRequestedRef = useRef(false);
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
            voiceCancelRequestedRef.current = false;
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

                const wasCanceled = voiceCancelRequestedRef.current;
                voiceCancelRequestedRef.current = false;

                const fallbackMime = mimeType || "audio/webm";
                const blob = new Blob(voiceChunksRef.current, { type: fallbackMime });
                if (!wasCanceled && blob.size > 0) {
                    setRecordedVoiceBlob(blob);
                    } else if (wasCanceled) {
                    clearRecordedVoice();
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
        voiceCancelRequestedRef.current = false;

        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            recorder.stop();
            return;
        }

        stopVoiceTimer();
        stopVoiceTracks();
        setIsRecordingVoice(false);
    }, [isRecordingVoice, stopVoiceTimer, stopVoiceTracks]);

    const resetVoiceComposer = useCallback(() => {
        voiceCancelRequestedRef.current = true;

        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            recorder.stop();
        }

        stopVoiceTimer();
        stopVoiceTracks();
        setIsRecordingVoice(false);
        clearRecordedVoice();
        voiceChunksRef.current = [];
    }, [clearRecordedVoice, stopVoiceTimer, stopVoiceTracks]);

    const cancelVoiceRecording = useCallback(() => {
        resetVoiceComposer();
    }, [resetVoiceComposer]);

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
        resetVoiceComposer();
    }, [chat?.id, resetVoiceComposer, stopTypingNow]);

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
                alert("Файл не загрузился на сервер. Повтори отправку.");
                return;
            }

            if (imageUrl) {
                onSend({ 
                    text,
                    type: "media",
                    imageUrl,
                    attachments: [
                        {
                            mediaType: "image",
                            url: imageUrl,
                            mimeType: selectedImageFile?.type || null,
                            sizeBytes: selectedImageFile?.size ?? null,
                        },
                    ],
                });
            } else {
                onSend({ text });
            }

            onDraftChange?.("");
            stopTypingNow();
            setEmojiOpen(false);
            clearSelectedImage();
        } catch (err) {
            console.error(err);
            alert("Ошибка при отправке. Проверь сервер /upload.");
        }
    };

    const handleSendVoice = async () => {
        if (!chat || isRecordingVoice || !recordedVoiceBlob) return;

        if (selectedImageFile) {
            alert("Голосовое отправляется отдельно от картинки.");
            return;
        }

        try {
            const audioUrl = await uploadRecordedVoice(recordedVoiceBlob);
            if (!audioUrl) {
                alert("Не удалось загрузить голосовое сообщение.");

                return;
            }

            if (audioUrl.startsWith("blob:")) {
                alert("Файл не загрузился на сервер. Повтори отправку.");
                return;
            }

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

            onDraftChange?.("");
            stopTypingNow();
            setEmojiOpen(false);
            clearRecordedVoice();
        } catch (err) {
            console.error(err);
            alert("Ошибка при отправке голосового. Проверь сервер /upload.");
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
    const filteredMessages = useMemo(() => {
        const allMessages = chat?.messages ?? [];
        const q = searchText.trim().toLowerCase();
        if (!q) return allMessages;

        return allMessages.filter((message) => {
            const text = typeof message?.text === "string" ? message.text.toLowerCase() : "";
            const senderName = typeof message?.senderName === "string" ? message.senderName.toLowerCase() : "";
            const senderId = typeof message?.senderId === "string" ? message.senderId.toLowerCase() : "";

            const legacyUrls = [
                typeof message?.imageUrl === "string" ? message.imageUrl : "",
                ...(Array.isArray(message?.imageUrls) ? message.imageUrls : []),
            ]
                .filter(Boolean)
                .map((item) => String(item).toLowerCase());

            const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
            const attachmentMeta = attachments
                .flatMap((attachment) => [
                    attachment?.mediaType,
                    attachment?.mimeType,
                    attachment?.url,
                    attachment?.fileName,
                ])
                .filter(Boolean)
                .map((item) => String(item).toLowerCase());

            const hasImageAttachment = attachments.some((attachment) => attachment?.mediaType === "image");
            const hasAudioAttachment = attachments.some((attachment) => attachment?.mediaType === "audio");
            const mediaKeywords = [
                hasImageAttachment ? "image фото картинка" : "",
                hasAudioAttachment ? "audio аудио голос голосовое" : "",
            ].join(" ");

            const haystack = [
                text,
                senderName,
                senderId,
                ...legacyUrls,
                ...attachmentMeta,
                mediaKeywords,
            ].join(" ");

            return haystack.includes(q);
        });
    }, [chat?.messages, searchText]);

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
                    {hasSelectedChat && !chat?.id?.startsWith?.("group-") ? (
                        <>
                            <button
                                type="button"
                                aria-label="audio-call"
                                title="Аудиозвонок"
                                onClick={() => onStartCall?.("audio")}
                            >
                                📞
                            </button>
                            <button
                                type="button"
                                aria-label="video-call"
                                title="Видеозвонок"
                                onClick={() => onStartCall?.("video")}
                            >
                                🎥
                            </button>
                        </>
                    ) : null}
                    <button
                        type="button"
                        aria-label="search"
                        onClick={() => {
                            setIsSearchOpen((prev) => !prev);
                            setIsHeaderMenuOpen(false);
                        }}
                    >
                        ⌕
                    </button>
                    <button
                        type="button"
                        aria-label="menu"
                        onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
                    >
                        ⋯
                    </button>
                </div>
            </header>
            {activeCall ? (
                <div className="chat-call-overlay">
                    <strong>{activeCall.type === "video" ? "🎥 Видеозвонок" : "📞 Аудиозвонок"}</strong>
                    <span className="chat-type">
                        {activeCall.direction === "incoming" ? "Входящий" : "Исходящий"} • {activeCall.status}
                    </span>
                    {activeCall.status === "connected" ? (
                        <span className="chat-type">Длительность: {formatCallDuration(callElapsedSec)}</span>
                    ) : null}
                    <div className="chat-call-actions">
                        {activeCall.direction === "incoming" && activeCall.status === "ringing" ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        getSocket()?.emit("call:accept", { callId: activeCall.callId });
                                    }}
                                >
                                    Принять
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        getSocket()?.emit("call:decline", { callId: activeCall.callId, reason: "declined" });
                                    }}
                                >
                                    Отклонить
                                </button>
                            </>
                        ) : null}
                        {activeCall.status === "initiated" || activeCall.status === "ringing" || activeCall.status === "connected" ? (
                            <button
                                type="button"
                                onClick={() => {
                                    getSocket()?.emit("call:end", { callId: activeCall.callId, reason: "hangup" });
                                }}
                            >
                                Завершить
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}
            {callOverlayError ? <div className="chat-call-error">{callOverlayError}</div> : null}
            {isSearchOpen ? (
                <div className="chat-search">
                    <input
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                        placeholder="Поиск по сообщениям..."
                    />
                    <button type="button" onClick={() => setSearchText("")}>Сброс</button>
                </div>
            ) : null}

            {isHeaderMenuOpen ? (
                <div className="chat-header-menu">
                    <button
                        type="button"
                        onClick={() => {
                            setIsSearchOpen(true);
                            setIsHeaderMenuOpen(false);
                        }}
                    >
                        Поиск сообщений
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
                            setIsHeaderMenuOpen(false);
                        }}
                    >
                        К последнему сообщению
                    </button>
                </div>
            ) : null}

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

                                {filteredMessages.map((m) => (
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

                        {filteredMessages.map((m) => {
                            const hasSender = Boolean(m.senderId);
                            const isMe = hasSender ? m.senderId === currentUserId : m.fromMe === true;

                            return (
                                <div key={m.id} className={`message ${isMe ? "outgoing" : "incoming"}`}>
                                    <div className="bubble">
                                        {(() => {
                                            const legacyUrls = Array.isArray(m.imageUrls)
                                                ? m.imageUrls
                                                : (m.imageUrl ? [m.imageUrl] : []);
                                            const attachmentUrls = Array.isArray(m.attachments)
                                                ? m.attachments
                                                    .filter((attachment) => attachment?.mediaType === "image" && attachment?.url)
                                                    .map((attachment) => attachment.url)
                                                : [];
                                            const urls = [...new Set([...legacyUrls, ...attachmentUrls])];
                                            
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
                            {!isRecordingVoice ? (
                                <button
                                    type="button"
                                    className="voice-send-btn"
                                    onClick={handleSendVoice}
                                    disabled={uploading || !recordedVoiceBlob || !canPublish}
                                >
                                    Отправить голосовое
                                </button>
                            ) : null}
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