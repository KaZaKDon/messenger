import { useEffect, useState } from "react";

import { API_BASE_URL } from "../../../shared/config";
import { ADVERTISEMENT_MODERATION_REASONS, buildModerationReason } from "../advertisementModerationModel";
import { COMPLAINT_STATUS_LABELS, complaintTargetTitle } from "../complaintManagementModel";

function dateTime(value) {
    return value ? new Date(value).toLocaleString("ru-RU") : "—";
}

function imageUrl(value) {
    if (!value || /^https?:\/\//i.test(value)) return value;
    return `${API_BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}

export default function AdminComplaintDetails({ complaint, processing, error, onReview, onClose }) {
    const [decision, setDecision] = useState("");
    const [reason, setReason] = useState("");
    const [comment, setComment] = useState("");
    const snapshot = complaint.targetSnapshot ?? {};
    const isClosed = ["resolved", "rejected"].includes(complaint.status);
    const isAdvertisement = complaint.targetType === "advertisement";

    useEffect(() => {
        setDecision("");
        setReason("");
        setComment("");
    }, [complaint.id]);

    const submit = (event) => {
        event.preventDefault();
        if (decision === "rejected") {
            onReview({ status: "rejected", resolution: comment.trim(), advertisementAction: "none" });
            return;
        }
        if (decision === "resolved") {
            onReview({ status: "resolved", resolution: comment.trim(), advertisementAction: "none" });
            return;
        }
        const actionReason = buildModerationReason(reason, comment);
        const prefix = decision === "needs_edit" ? "Объявление отправлено на исправление" : "Объявление снято окончательно";
        onReview({
            status: "resolved",
            resolution: `${prefix}. ${actionReason}`,
            advertisementAction: decision,
            actionReason,
        });
    };

    const needsModerationReason = ["needs_edit", "removed"].includes(decision);
    const canSubmit = comment.trim().length >= 3 && (!needsModerationReason || reason);

    return (
        <div className="admin-complaint-modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !processing && onClose()}>
            <article className="admin-complaint-details" role="dialog" aria-modal="true" aria-labelledby="admin-complaint-title">
                <header>
                    <div><span>{COMPLAINT_STATUS_LABELS[complaint.status]}</span><h2 id="admin-complaint-title">{complaintTargetTitle(complaint)}</h2></div>
                    <button type="button" onClick={onClose} disabled={processing} aria-label="Закрыть">×</button>
                </header>

                <section className="admin-complaint-report">
                    <h3>Жалоба</h3>
                    <dl>
                        <div><dt>Причина</dt><dd>{complaint.reason}</dd></div>
                        <div><dt>Заявитель</dt><dd>{complaint.reporter?.name || "—"}<br />{complaint.reporter?.phone || ""}</dd></div>
                        <div><dt>Подана</dt><dd>{dateTime(complaint.createdAt)}</dd></div>
                        <div><dt>Ответственный</dt><dd>{complaint.assignedTo?.name || "Не назначен"}</dd></div>
                    </dl>
                    <p>{complaint.details || "Пояснение не добавлено"}</p>
                </section>

                {isAdvertisement ? (
                    <section className="admin-complaint-snapshot">
                        <h3>Снимок объявления на момент жалобы</h3>
                        {snapshot.images?.length ? <div>{snapshot.images.map((image) => <img key={`${image.sortOrder}-${image.url}`} src={imageUrl(image.url)} alt="" />)}</div> : null}
                        <strong>{snapshot.title}</strong>
                        <small>{snapshot.groupTitle} · {snapshot.settlement}{snapshot.price ? ` · ${snapshot.price}` : ""}</small>
                        <p>{snapshot.description}</p>
                    </section>
                ) : null}

                {complaint.resolution ? (
                    <section className="admin-complaint-resolution"><h3>Результат рассмотрения</h3><p>{complaint.resolution}</p><small>{dateTime(complaint.resolvedAt)}</small></section>
                ) : null}
                {error ? <p className="admin-complaint-error" role="alert">{error}</p> : null}

                {!isClosed ? (
                    <section className="admin-complaint-actions">
                        <h3>Решение</h3>
                        {complaint.status === "new" ? <button type="button" className="primary" disabled={processing} onClick={() => onReview({ status: "in_review", resolution: "" })}>Взять в работу</button> : null}
                        <form onSubmit={submit}>
                            <label>
                                Действие
                                <select required value={decision} onChange={(event) => { setDecision(event.target.value); setReason(""); }}>
                                    <option value="">Выберите решение</option>
                                    <option value="rejected">Нарушений нет — отклонить жалобу</option>
                                    <option value="resolved">Решить без действий с объявлением</option>
                                    {isAdvertisement ? <option value="needs_edit">Отправить объявление на исправление</option> : null}
                                    {isAdvertisement ? <option value="removed">Снять объявление окончательно</option> : null}
                                </select>
                            </label>
                            {needsModerationReason ? (
                                <label>
                                    Причина для автора
                                    <select required value={reason} onChange={(event) => setReason(event.target.value)}>
                                        <option value="">Выберите причину</option>
                                        {ADVERTISEMENT_MODERATION_REASONS[decision].map((item) => <option key={item} value={item}>{item}</option>)}
                                    </select>
                                </label>
                            ) : null}
                            {decision ? <label>Пояснение<textarea required minLength={3} maxLength={700} value={comment} onChange={(event) => setComment(event.target.value)} /></label> : null}
                            {decision ? <div><button type="submit" className={decision === "removed" ? "danger" : "primary"} disabled={processing || !canSubmit}>Подтвердить решение</button></div> : null}
                        </form>
                    </section>
                ) : null}
            </article>
        </div>
    );
}
