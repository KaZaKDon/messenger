import { useState } from "react";
import { createPortal } from "react-dom";

import { ADVERTISEMENT_COMPLAINT_REASONS, canSubmitComplaint } from "../../../shared/complaintModel";
import { createAdvertisementComplaint } from "../../../shared/complaintsApi";

export default function ComplaintDialog({ advertisement, onClose, onSent }) {
    const [reason, setReason] = useState("");
    const [details, setDetails] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        if (!canSubmitComplaint({ reason, details })) return;
        setSubmitting(true);
        setError("");
        try {
            await createAdvertisementComplaint(advertisement.id, reason, details.trim());
            onSent();
        } catch (requestError) {
            setError(requestError?.message ?? "Не удалось отправить жалобу");
        } finally {
            setSubmitting(false);
        }
    };

    return createPortal(
        <div className="complaint-modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
            <form className="complaint-dialog" role="dialog" aria-modal="true" aria-labelledby="complaint-title" onSubmit={submit}>
                <header>
                    <div><span>Жалоба на объявление</span><h2 id="complaint-title">{advertisement.title}</h2></div>
                    <button type="button" onClick={onClose} disabled={submitting} aria-label="Закрыть">×</button>
                </header>
                <label>
                    Причина
                    <select autoFocus required value={reason} onChange={(event) => setReason(event.target.value)}>
                        <option value="">Выберите причину</option>
                        {ADVERTISEMENT_COMPLAINT_REASONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                </label>
                <label>
                    Пояснение
                    <textarea required minLength={3} maxLength={3000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Опишите, что именно нарушено" />
                </label>
                {error ? <p className="complaint-error" role="alert">{error}</p> : null}
                <footer>
                    <button type="button" onClick={onClose} disabled={submitting}>Отмена</button>
                    <button type="submit" className="primary" disabled={submitting || !canSubmitComplaint({ reason, details })}>{submitting ? "Отправляем…" : "Отправить жалобу"}</button>
                </footer>
            </form>
        </div>,
        document.body,
    );
}
