import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContacts } from "../../shared/useContacts";

const CALLS_STORAGE_KEY = "callsHistory";

function readCallHistory() {
    try {
        const raw = localStorage.getItem(CALLS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeCallHistory(next) {
    localStorage.setItem(CALLS_STORAGE_KEY, JSON.stringify(next.slice(0, 200)));
}

function formatDuration(durationSec) {
    if (!Number.isFinite(durationSec) || durationSec <= 0) return "—";
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function Calls() {
    const navigate = useNavigate();
    const { contacts, loading } = useContacts();
    const [filter, setFilter] = useState("all");
    const [callHistory, setCallHistory] = useState(() => readCallHistory());

    const contactsById = useMemo(() => {
        return Object.fromEntries(contacts.map((contact) => [contact.id, contact]));
    }, [contacts]);

    const filteredHistory = useMemo(() => {
        return callHistory
            .filter((item) => (filter === "missed" ? item.status === "missed" : true))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [callHistory, filter]);

    const startCall = (contact, type) => {
        const record = {
            id: crypto.randomUUID(),
            contactId: contact.id,
            contactName: contact.name,
            type,
            direction: "outgoing",
            status: "completed",
            durationSec: 0,
            createdAt: new Date().toISOString(),
        };

        const next = [record, ...callHistory];
        setCallHistory(next);
        writeCallHistory(next);

        navigate(`/chat?user=${encodeURIComponent(contact.id)}`);
    };

    const clearHistory = () => {
        setCallHistory([]);
        writeCallHistory([]);
    };

    return (
        <section className="settings-page">
            <header className="settings-header">
                <h1>Звонки</h1>
            </header>

            <div className="settings-panel">
                <div className="settings-list-item">
                    <strong>Быстрый вызов</strong>
                    <div>
                        <button type="button" onClick={() => setFilter("all")}>Все</button>{" "}
                        <button type="button" onClick={() => setFilter("missed")}>Пропущенные</button>{" "}
                        <button type="button" onClick={clearHistory}>Очистить</button>
                    </div>
                </div>

                {loading ? <p>Загружаем контакты...</p> : null}

                {!loading && contacts.length === 0 ? <p>Контактов пока нет.</p> : null}

                {contacts.map((contact) => (
                    <div key={contact.id} className="settings-list-item">
                        <span>{contact.name}</span>
                        <div>
                            <button type="button" onClick={() => startCall(contact, "audio")}>📞 Аудио</button>{" "}
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
                        <div key={item.id} className="settings-list-item">
                            <div>
                                <strong>{callEmoji} {contactName}</strong>
                                <div>
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
            </div>
        </section>
    );
}
