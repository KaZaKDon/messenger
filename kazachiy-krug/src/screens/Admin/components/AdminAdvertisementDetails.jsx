import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../../shared/config";
import {
    ADVERTISEMENT_STATUS_LABELS,
    advertisementGroupTitle,
    effectiveAdvertisementStatus,
    remainingPublicationLabel,
} from "../advertisementManagementModel";
import {
    ADVERTISEMENT_MODERATION_REASONS,
    buildModerationReason,
    moderationActionLabel,
} from "../advertisementModerationModel";

function dateTime(value) {
    return value ? new Date(value).toLocaleString("ru-RU") : "—";
}

function imageUrl(value) {
    if (!value || /^https?:\/\//i.test(value)) return value;
    return `${API_BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}

export default function AdminAdvertisementDetails({ advertisement, processing, error, onModerate, onClose }) {
    const [action, setAction] = useState("");
    const [reason, setReason] = useState("");
    const [comment, setComment] = useState("");
    const status = effectiveAdvertisementStatus(advertisement);

    useEffect(() => {
        setAction("");
        setReason("");
        setComment("");
    }, [advertisement.id]);

    const start = (nextAction) => {
        if (nextAction === "active") {
            onModerate("active", "");
            return;
        }
        setAction(nextAction);
        setReason("");
        setComment("");
    };

    const submit = (event) => {
        event.preventDefault();
        onModerate(action, buildModerationReason(reason, comment));
    };

    return (
        <div className="admin-ad-modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !processing && onClose()}>
            <article className="admin-ad-details" role="dialog" aria-modal="true" aria-labelledby="admin-ad-title">
                <header>
                    <div>
                        <span>{advertisementGroupTitle(advertisement)} · {ADVERTISEMENT_STATUS_LABELS[status]}</span>
                        <h2 id="admin-ad-title">{advertisement.title}</h2>
                    </div>
                    <button type="button" onClick={onClose} disabled={processing} aria-label="Закрыть">×</button>
                </header>

                {advertisement.images?.length ? (
                    <div className="admin-ad-gallery">
                        {advertisement.images.map((image) => <img key={image.id || image.url} src={imageUrl(image.url)} alt="" />)}
                    </div>
                ) : <p className="admin-ad-no-image">Фотографии не добавлены</p>}

                <section className="admin-ad-copy">
                    <div className="admin-ad-price">{advertisement.price || "Цена не указана"}</div>
                    <p>{advertisement.description}</p>
                    <dl>
                        <div><dt>Населённый пункт</dt><dd>{advertisement.settlement}</dd></div>
                        <div><dt>Автор</dt><dd>{advertisement.author?.name || "—"}</dd></div>
                        <div><dt>Телефон</dt><dd>{advertisement.author?.phone || "—"}</dd></div>
                        <div><dt>Опубликовано</dt><dd>{dateTime(advertisement.publishedAt)}</dd></div>
                        <div><dt>Окончание</dt><dd>{dateTime(advertisement.expiresAt)} · {remainingPublicationLabel(advertisement)}</dd></div>
                    </dl>
                </section>

                {advertisement.moderationReason ? (
                    <section className="admin-ad-history">
                        <h3>Последнее решение модерации</h3>
                        <p>{advertisement.moderationReason}</p>
                        <small>{advertisement.moderatedBy?.name || "Сотрудник"} · {dateTime(advertisement.moderatedAt)}</small>
                    </section>
                ) : null}

                {error ? <p className="admin-ad-error" role="alert">{error}</p> : null}

                {status !== "deleted" ? (
                    <section className="admin-ad-actions">
                        <h3>Действия</h3>
                        <div>
                            {status !== "active" ? <button type="button" className="primary" onClick={() => start("active")} disabled={processing}>Восстановить</button> : null}
                            {status !== "needs_edit" ? <button type="button" onClick={() => start("needs_edit")} disabled={processing}>На исправление</button> : null}
                            {status !== "removed" ? <button type="button" className="danger" onClick={() => start("removed")} disabled={processing}>Снять окончательно</button> : null}
                        </div>
                        {action ? (
                            <form onSubmit={submit}>
                                <h4>{moderationActionLabel(action)}</h4>
                                <label>
                                    Причина
                                    <select autoFocus required value={reason} onChange={(event) => setReason(event.target.value)}>
                                        <option value="">Выберите причину</option>
                                        {ADVERTISEMENT_MODERATION_REASONS[action]?.map((item) => <option key={item} value={item}>{item}</option>)}
                                    </select>
                                </label>
                                <label>
                                    Пояснение автору
                                    <textarea required minLength={3} maxLength={700} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Кратко укажите, что именно нужно исправить или почему объявление снято" />
                                </label>
                                <div><button type="button" onClick={() => setAction("")} disabled={processing}>Отмена</button><button type="submit" className="primary" disabled={processing || !reason || comment.trim().length < 3}>{moderationActionLabel(action)}</button></div>
                            </form>
                        ) : null}
                    </section>
                ) : <p className="admin-ad-final-note">Объявление скрыто окончательно, но сохранено в базе и журнале действий.</p>}
            </article>
        </div>
    );
}
