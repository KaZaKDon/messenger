import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContacts } from "../../shared/useContacts";
import { connectSocket } from "../../shared/socket";
import "./Calls.css";

function buildCallsStorageKey(userId) {
    return `callsHistory:${userId || "guest"}`;
}

function readCallHistory(storageKey) {
    try {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeCallHistory(storageKey, next) {
    try {
        localStorage.setItem(storageKey, JSON.stringify(next.slice(0, 200)));
    } catch {
        // ignore storage errors
    }
}

function formatDuration(durationSec) {
    if (!Number.isFinite(durationSec) || durationSec <= 0) return "—";
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
}

function createCallId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `call-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildPrivateRoomId(userA, userB) {
    return `room-${[userA, userB].sort().join("-")}`;
}

function normalizeHistoryStatus(session) {
    if (session?.status === "missed" || session?.endedReason === "timeout") return "missed";
    return "completed";
}

export default function Calls({ currentUser }) {
    const navigate = useNavigate();
    const { contacts, loading } = useContacts(currentUser?.id);
    const [filter, setFilter] = useState("all");
    const storageKey = useMemo(() => buildCallsStorageKey(currentUser?.id), [currentUser?.id]);
    const [callHistory, setCallHistory] = useState(() => readCallHistory(storageKey));
    const [activeCall, setActiveCall] = useState(null);
    const [callError, setCallError] = useState("");
    const [lastStartedMeta, setLastStartedMeta] = useState(null);

    useEffect(() => {
        setCallHistory(readCallHistory(storageKey));
    }, [storageKey]);

    const contactsById = useMemo(() => {
        return Object.fromEntries(contacts.map((contact) => [contact.id, contact]));
    }, [contacts]);

    const filteredHistory = useMemo(() => {
        return callHistory
            .filter((item) => (filter === "missed" ? item.status === "missed" : true))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [callHistory, filter]);

    const appendHistory = useCallback((record) => {
        setCallHistory((prev) => {
            const merged = new Map();
            [record, ...prev].forEach((row) => {
                if (!row?.id) return;
                if (!merged.has(row.id)) merged.set(row.id, row);
            });
            const next = [...merged.values()]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 200);
            writeCallHistory(storageKey, next);
            return next;
        });
    }, [storageKey]);

    const startCall = (contact, type) => {
        if (!currentUser?.id) return;
        setCallError("");

        const chatId = buildPrivateRoomId(currentUser.id, contact.id);
        if (activeCall?.chatId === chatId && ["initiated", "ringing", "connected"].includes(activeCall.status)) {
            setCallError("В этом чате уже есть активный звонок");
            return;
        }
        const socket = connectSocket();

        setLastStartedMeta({
            callAttemptId: createCallId(),
            contactId: contact.id,
            contactName: contact.name,
            chatId,
            type
        });

        socket.emit("call:start", { chatId, type, targetUserId: contact.id });
        navigate(`/chat?user=${encodeURIComponent(contact.id)}`);
    };

    const clearHistory = () => {
        setCallHistory([]);
        writeCallHistory(storageKey, []);
    };

    useEffect(() => {
        const socket = connectSocket();
        if (!socket || !currentUser?.id) return;

        const onCallStarted = (payload = {}) => {
            const fallbackContact = contactsById[lastStartedMeta?.contactId];
            setActiveCall({
                callId: payload.callId,
                chatId: payload.chatId,
                type: payload.type ?? lastStartedMeta?.type ?? "audio",
                status: payload.status ?? "initiated",
                direction: "outgoing",
                contactId: fallbackContact?.id ?? lastStartedMeta?.contactId ?? null,
                contactName: fallbackContact?.name ?? lastStartedMeta?.contactName ?? "Контакт",
            });
        };

        const onCallIncoming = (payload = {}) => {
            const incomingContact = contactsById[payload.fromUserId];
            setActiveCall({
                callId: payload.callId,
                chatId: payload.chatId,
                type: payload.type ?? "audio",
                status: payload.status ?? "ringing",
                direction: "incoming",
                contactId: incomingContact?.id ?? payload.fromUserId ?? null,
                contactName: incomingContact?.name ?? "Входящий вызов",
            });
        };

        const onCallRinging = (payload = {}) => {
            setActiveCall((prev) => {
                if (!prev || prev.callId !== payload.callId) return prev;
                return { ...prev, status: payload.status ?? "ringing" };
            });
        };

        const onCallAccepted = (payload = {}) => {
            setActiveCall((prev) => {
                if (!prev || prev.callId !== payload.callId) return prev;
                return { ...prev, status: payload.status ?? "connected" };
            });
        };

        const onCallFinished = (payload = {}) => {
            setActiveCall((prev) => (prev?.callId === payload.callId ? null : prev));

            const contact = contacts.find((item) => buildPrivateRoomId(currentUser.id, item.id) === payload.chatId);
            const historyRecord = {
                id: payload.callId ?? createCallId(),
                contactId: contact?.id ?? null,
                contactName: contact?.name ?? "Неизвестный",
                type: payload.type ?? "audio",
                direction: payload.endedBy === currentUser.id ? "outgoing" : "incoming",
                status: payload.endedReason === "timeout" ? "missed" : "completed",
                durationSec: Number.isFinite(payload.durationSec) ? payload.durationSec : 0,
                createdAt: payload.createdAt ?? new Date().toISOString(),
            };
            appendHistory(historyRecord);
        };

        const onCallError = ({ code, message, chatId } = {}) => {
            if (code === "FORBIDDEN_CHAT_ACCESS" && message === "No access to chat") {
                const isHistoryLookup = contacts.some((item) => buildPrivateRoomId(currentUser.id, item.id) === chatId);
                if (isHistoryLookup) return;
            }
            setCallError(message ?? "Ошибка звонка");
        };

        const onCallHistory = ({ chatId, items = [] } = {}) => {
            const contact = contacts.find((item) => buildPrivateRoomId(currentUser.id, item.id) === chatId);
            if (!contact) return;

            setCallHistory((prev) => {
                const incoming = items.map((item) => ({
                    id: item.callId ?? createCallId(),
                    contactId: contact.id,
                    contactName: contact.name,
                    type: item.type ?? "audio",
                    direction: item.initiatorId === currentUser.id ? "outgoing" : "incoming",
                    status: normalizeHistoryStatus(item),
                    durationSec: Number.isFinite(item.durationSec) ? item.durationSec : 0,
                    createdAt: item.createdAt ?? new Date().toISOString(),
                }));

                const mergedMap = new Map();
                [...incoming, ...prev].forEach((row) => {
                    if (!mergedMap.has(row.id)) mergedMap.set(row.id, row);
                });

                const next = [...mergedMap.values()]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 200);
                writeCallHistory(storageKey, next);
                return next;
            });
        };

        socket.on("call:started", onCallStarted);
        socket.on("call:incoming", onCallIncoming);
        socket.on("call:ringing", onCallRinging);
        socket.on("call:accepted", onCallAccepted);
        socket.on("call:declined", onCallFinished);
        socket.on("call:ended", onCallFinished);
        socket.on("call:error", onCallError);
        socket.on("call:history", onCallHistory);

        contacts.forEach((contact) => {
            const chatId = buildPrivateRoomId(currentUser.id, contact.id);
            socket.emit("call:history:get", { chatId, limit: 20 });
        });

        return () => {
            socket.off("call:started", onCallStarted);
            socket.off("call:incoming", onCallIncoming);
            socket.off("call:ringing", onCallRinging);
            socket.off("call:accepted", onCallAccepted);
            socket.off("call:declined", onCallFinished);
            socket.off("call:ended", onCallFinished);
            socket.off("call:error", onCallError);
            socket.off("call:history", onCallHistory);
        };
    }, [appendHistory, contacts, contactsById, currentUser?.id, lastStartedMeta, storageKey]);

    const handleAcceptCall = () => {
        if (!activeCall?.callId) return;
        connectSocket().emit("call:accept", { callId: activeCall.callId });
    };

    const handleDeclineCall = () => {
        if (!activeCall?.callId) return;
        connectSocket().emit("call:decline", { callId: activeCall.callId, reason: "declined" });
    };

    const handleEndCall = () => {
        if (!activeCall?.callId) return;
        connectSocket().emit("call:end", { callId: activeCall.callId, reason: "hangup" });
    };

    return (
        <section className="calls-page">
            <header className="calls-header">
                <h1>Звонки</h1>
            </header>

            <div className="calls-panel">
                <div className="calls-toolbar">
                    <strong>Быстрый вызов</strong>
                    <div className="calls-toolbar-actions">
                        <button type="button" onClick={() => setFilter("all")}>Все</button>
                        <button type="button" onClick={() => setFilter("missed")}>Пропущенные</button>
                        <button type="button" onClick={clearHistory}>Очистить</button>
                    </div>
                </div>

                {loading ? <p>Загружаем контакты...</p> : null}

                {!loading && contacts.length === 0 ? <p>Контактов пока нет.</p> : null}

                {!loading && contacts.map((contact) => (
                    <div key={contact.id} className="calls-list-item">
                        <span>{contact.name}</span>
                        <div className="calls-actions">
                            <button type="button" onClick={() => startCall(contact, "audio")}>📞 Аудио</button>
                            <button type="button" onClick={() => startCall(contact, "video")}>🎥 Видео</button>
                        </div>
                    </div>
                ))}

                <hr />

                <h2>История</h2>
                {filteredHistory.length === 0 ? <p>История звонков пуста.</p> : null}
                {filteredHistory.map((item) => {
                    const contactName = contactsById[item.contactId]?.name ?? item.contactName ?? "Неизвестный";
                    const callEmoji = item.type === "video" ? "🎥" : "📞";
                    const statusLabel = item.status === "missed" ? "Пропущен" : "Завершён";

                    return (
                        <div key={item.id} className="calls-list-item">
                            <div>
                                <strong>{callEmoji} {contactName}</strong>
                                <div className="calls-meta">
                                    {statusLabel} • {new Date(item.createdAt).toLocaleString()} • {formatDuration(item.durationSec)}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate(`/chat?user=${encodeURIComponent(item.contactId)}`)}
                            >
                                Открыть чат
                            </button>
                        </div>
                    );
                })}

                {callError ? <p className="calls-error">{callError}</p> : null}

                {activeCall ? (
                    <div className="calls-active-card">
                        <strong>
                            {activeCall.type === "video" ? "🎥" : "📞"} {activeCall.contactName}
                        </strong>
                        <div className="calls-meta">
                            Статус: {activeCall.status} • {activeCall.direction === "incoming" ? "входящий" : "исходящий"}
                        </div>
                        <div className="calls-actions">
                            {activeCall.direction === "incoming" && activeCall.status === "ringing" ? (
                                <>
                                    <button type="button" onClick={handleAcceptCall}>Принять</button>
                                    <button type="button" onClick={handleDeclineCall}>Отклонить</button>
                                </>
                            ) : null}
                            {activeCall.status === "connected" || activeCall.status === "ringing" || activeCall.status === "initiated" ? (
                                <button type="button" onClick={handleEndCall}>Завершить</button>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => {
                                    if (activeCall.contactId) {
                                        navigate(`/chat?user=${encodeURIComponent(activeCall.contactId)}`);
                                    }
                                }}
                            >
                                В чат
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        </section>
    );
}
