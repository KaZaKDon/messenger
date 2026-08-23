import { useState } from "react";

import { SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS } from "../../../shared/supportRequestModel";

export default function AdminSupportRequestDetails({ request, processing, error, onStart, onAnswer, onCloseRequest, onClose }) {
    const [answer, setAnswer] = useState("");
    const closed = request.status === "closed";
    const submit = async (event) => {
        event.preventDefault();
        if (answer.trim().length < 2) return;
        await onAnswer(answer.trim());
        setAnswer("");
    };

    return (
        <div className="admin-support-modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !processing && onClose()}>
            <article className="admin-support-details" role="dialog" aria-modal="true" aria-labelledby="admin-support-title">
                <header><div><span>{SUPPORT_CATEGORY_LABELS[request.category] || "Другое"} · {SUPPORT_STATUS_LABELS[request.status]}</span><h2 id="admin-support-title">{request.subject}</h2></div><button type="button" onClick={onClose} disabled={processing} aria-label="Закрыть">×</button></header>
                <section className="admin-support-author"><div><small>Автор</small><strong>{request.author?.name || "—"}</strong></div><div><small>Телефон</small><strong>{request.author?.phone || "—"}</strong></div><div><small>Ответственный</small><strong>{request.assignedTo?.name || "Не назначен"}</strong></div><div><small>Создано</small><strong>{new Date(request.createdAt).toLocaleString("ru-RU")}</strong></div></section>
                <section className="admin-support-thread">
                    {request.messages.map((message) => {
                        const staff = ["admin", "moderator"].includes(message.author?.role);
                        return <div key={message.id} className={`admin-support-message ${staff ? "staff" : "user"}`}><strong>{staff ? message.author?.name || "Администрация" : request.author?.name || "Пользователь"}</strong><p>{message.text}</p><small>{new Date(message.createdAt).toLocaleString("ru-RU")}</small></div>;
                    })}
                </section>
                {error ? <p className="admin-support-error" role="alert">{error}</p> : null}
                {!closed ? (
                    <section className="admin-support-actions">
                        {request.status === "new" ? <button type="button" className="primary" onClick={onStart} disabled={processing}>Взять в работу</button> : null}
                        <form onSubmit={submit}><textarea value={answer} onChange={(event) => setAnswer(event.target.value)} maxLength={5000} placeholder="Ответ пользователю…" /><div><button type="button" onClick={() => window.confirm("Закрыть обращение?") && onCloseRequest()} disabled={processing}>Закрыть обращение</button><button type="submit" className="primary" disabled={processing || answer.trim().length < 2}>Отправить ответ</button></div></form>
                    </section>
                ) : <p className="admin-support-closed">Обращение закрыто. История переписки сохранена.</p>}
            </article>
        </div>
    );
}
