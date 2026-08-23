import { useCallback, useEffect, useState } from "react";

import { SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS, validSupportDraft } from "../../shared/supportRequestModel";
import {
    addSupportMessage,
    closeMySupportRequest,
    createSupportRequest,
    fetchMySupportRequests,
    markSupportRequestRead,
    notifySupportRequestsUpdated,
} from "../../shared/supportRequestsApi";
import "./supportRequests.css";

const EMPTY_DRAFT = { category: "question", subject: "", text: "" };

export default function SupportRequests({ currentUser }) {
    const [requests, setRequests] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [creating, setCreating] = useState(false);
    const [draft, setDraft] = useState(EMPTY_DRAFT);
    const [reply, setReply] = useState("");
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try { setRequests(await fetchMySupportRequests()); }
        catch (requestError) { setError(requestError.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);
    const selected = requests.find((request) => request.id === selectedId) ?? null;

    const openRequest = async (request) => {
        setCreating(false);
        setSelectedId(request.id);
        setReply("");
        if (request.unread) {
            try {
                await markSupportRequestRead(request.id);
                setRequests((items) => items.map((item) => item.id === request.id ? { ...item, unread: false } : item));
                notifySupportRequestsUpdated();
            } catch { /* чтение обращения остаётся доступным */ }
        }
    };

    const create = async (event) => {
        event.preventDefault();
        if (!validSupportDraft(draft)) return;
        setProcessing(true);
        setError("");
        try {
            const payload = await createSupportRequest(draft);
            setDraft(EMPTY_DRAFT);
            setCreating(false);
            await load();
            setSelectedId(payload.request.id);
            notifySupportRequestsUpdated();
        } catch (requestError) { setError(requestError.message); }
        finally { setProcessing(false); }
    };

    const sendReply = async (event) => {
        event.preventDefault();
        if (reply.trim().length < 2) return;
        setProcessing(true);
        setError("");
        try {
            await addSupportMessage(selected.id, reply.trim());
            setReply("");
            await load();
            notifySupportRequestsUpdated();
        } catch (requestError) { setError(requestError.message); }
        finally { setProcessing(false); }
    };

    const close = async () => {
        if (!window.confirm("Закрыть обращение? После этого дописать в него будет нельзя.")) return;
        setProcessing(true);
        try {
            await closeMySupportRequest(selected.id);
            await load();
            notifySupportRequestsUpdated();
        } catch (requestError) { setError(requestError.message); }
        finally { setProcessing(false); }
    };

    return (
        <section className="support-page">
            <header className="support-header">
                <div><h1>Обращения</h1><p>Вопросы, предложения и официальные ответы администрации.</p></div>
                <button type="button" onClick={() => { setCreating(true); setSelectedId(null); setError(""); }}>+ Новое обращение</button>
            </header>
            {error ? <p className="support-error" role="alert">{error}</p> : null}
            <div className="support-layout">
                <aside className={`support-list ${creating || selected ? "has-selection" : ""}`}>
                    {loading ? <p>Загрузка…</p> : null}
                    {!loading && requests.length === 0 ? <p>Обращений пока нет.</p> : null}
                    {requests.map((request) => (
                        <button key={request.id} type="button" className={`${selectedId === request.id ? "active" : ""} ${request.unread ? "unread" : ""}`} onClick={() => openRequest(request)}>
                            <strong>{request.subject}</strong>
                            <span>{SUPPORT_CATEGORY_LABELS[request.category] || "Другое"}</span>
                            <small>{SUPPORT_STATUS_LABELS[request.status] || request.status}</small>
                            {request.unread ? <em>Новый ответ</em> : null}
                        </button>
                    ))}
                </aside>

                <main className={`support-content ${creating || selected ? "open" : ""}`}>
                    {creating ? (
                        <form className="support-create" onSubmit={create}>
                            <button type="button" className="support-back" onClick={() => setCreating(false)}>← К списку</button>
                            <h2>Новое обращение</h2>
                            <label>Категория<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{Object.entries(SUPPORT_CATEGORY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
                            <label>Тема<input required minLength={3} maxLength={160} value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} /></label>
                            <label>Текст<textarea required minLength={5} maxLength={5000} value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} /></label>
                            <button type="submit" className="primary" disabled={processing || !validSupportDraft(draft)}>{processing ? "Отправляем…" : "Отправить"}</button>
                        </form>
                    ) : selected ? (
                        <article className="support-thread">
                            <header><button type="button" className="support-back" onClick={() => setSelectedId(null)}>← К списку</button><div><span>{SUPPORT_CATEGORY_LABELS[selected.category] || "Другое"}</span><h2>{selected.subject}</h2><small>{SUPPORT_STATUS_LABELS[selected.status]}</small></div></header>
                            <div className="support-messages">
                                {selected.messages.map((message) => <div key={message.id} className={`support-message ${message.authorId === currentUser.id ? "mine" : "staff"}`}><strong>{message.authorId === currentUser.id ? "Вы" : "Администрация"}</strong><p>{message.text}</p><small>{new Date(message.createdAt).toLocaleString("ru-RU")}</small></div>)}
                            </div>
                            {selected.status !== "closed" ? <form className="support-reply" onSubmit={sendReply}><textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Уточнить или ответить…" maxLength={5000} /><div><button type="button" onClick={close} disabled={processing}>Закрыть обращение</button><button type="submit" className="primary" disabled={processing || reply.trim().length < 2}>Отправить</button></div></form> : <p className="support-closed">Обращение закрыто. Переписка доступна только для просмотра.</p>}
                        </article>
                    ) : <div className="support-placeholder"><span>✉</span><p>Выберите обращение или создайте новое.</p></div>}
                </main>
            </div>
        </section>
    );
}
