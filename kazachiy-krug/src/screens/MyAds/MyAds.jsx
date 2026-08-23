import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../../shared/config";
import { deleteAdvertisement, editAdvertisement, extendAdvertisement, fetchMyAdvertisements } from "../../shared/advertisementsApi";
import AnnouncementComposer from "../Chat/components/AnnouncementComposer";
import "../Settings/settings.css";
import "../Chat/chat.css";
import "./myAds.css";

const STATUS_LABELS = { active: "Активно", needs_edit: "Требуется доработка", removed: "Снято окончательно", expired: "Срок истёк" };

function imageSource(url) {
    if (!url || url.startsWith("http")) return url;
    return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function actualStatus(advertisement) {
    if (advertisement.status === "active" && advertisement.expiresAt
        && new Date(advertisement.expiresAt).getTime() <= Date.now()) return "expired";
    return advertisement.status;
}

export default function MyAds() {
    const [advertisements, setAdvertisements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [processingId, setProcessingId] = useState(null);
    const [editing, setEditing] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try { setAdvertisements(await fetchMyAdvertisements()); }
        catch (requestError) { setError(requestError?.message ?? "Не удалось загрузить объявления"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const activeCount = advertisements.filter((advertisement) => actualStatus(advertisement) === "active").length;
    const openCount = advertisements.filter((advertisement) => ["active", "needs_edit"].includes(actualStatus(advertisement))).length;

    const run = async (advertisement, action) => {
        setProcessingId(advertisement.id);
        setError("");
        try { await action(advertisement.id); await load(); }
        catch (requestError) { setError(requestError?.message ?? "Не удалось выполнить действие"); }
        finally { setProcessingId(null); }
    };

    return (
        <section className="my-ads-page">
            <header className="my-ads-header">
                <div>
                    <span className="my-ads-eyebrow">Личный кабинет</span>
                    <h1>Мои объявления</h1>
                    <p>Редактируйте, продлевайте и удаляйте свои публикации.</p>
                </div>
                <button className="my-ads-refresh" type="button" onClick={load} disabled={loading}>
                    {loading ? "Обновляем…" : "Обновить"}
                </button>
            </header>
            {!editing ? (
                <div className="my-ads-summary">
                    <div><span>Всего</span><strong>{advertisements.length}</strong></div>
                    <div><span>Активные</span><strong>{activeCount}</strong></div>
                    <div><span>Можно разместить</span><strong>{Math.max(0, 5 - openCount)}</strong></div>
                </div>
            ) : null}
            <div className={`my-ads-panel ${editing ? "editing" : ""}`}>
                {error ? <p className="my-ads-notice error">{error}</p> : null}
                {loading ? <p className="my-ads-notice">Загружаем объявления…</p> : null}
                {!loading && advertisements.length === 0 ? (
                    <div className="my-ads-empty">
                        <span>🧾</span>
                        <h2>Объявлений пока нет</h2>
                        <p>Создать первое объявление можно в подходящей группе.</p>
                    </div>
                ) : null}
                {editing ? (
                    <div className="my-ad-editor">
                        <button className="my-ad-back" type="button" onClick={() => setEditing(null)}>← Назад к списку</button>
                        <AnnouncementComposer
                            initialAdvertisement={editing}
                            imageRequired={false}
                            onSubmit={async (form) => {
                                setProcessingId(editing.id);
                                try {
                                    await editAdvertisement(editing.id, form);
                                    setEditing(null);
                                    await load();
                                } finally { setProcessingId(null); }
                            }}
                        />
                    </div>
                ) : advertisements.map((advertisement) => {
                    const status = actualStatus(advertisement);
                    const firstImage = advertisement.images?.[0]?.url;
                    const busy = processingId === advertisement.id;
                    return (
                        <article key={advertisement.id} className="my-ad-card">
                            {firstImage
                                ? <img src={imageSource(firstImage)} alt="" className="my-ad-image" />
                                : <div className="my-ad-image-placeholder" aria-label="Без фотографии">🧾</div>}
                            <div className="my-ad-copy">
                                <div className="my-ad-title-row">
                                    <h2>{advertisement.title}</h2>
                                    <span className={`my-ad-status status-${status}`}>{STATUS_LABELS[status] ?? status}</span>
                                </div>
                                <p className="my-ad-description">{advertisement.description}</p>
                                <div className="my-ad-meta">
                                    <span>📍 {advertisement.settlement}</span>
                                    {advertisement.price ? <span>₽ {advertisement.price}</span> : <span>Цена не указана</span>}
                                    {advertisement.expiresAt ? <span>До {new Date(advertisement.expiresAt).toLocaleDateString("ru-RU")}</span> : null}
                                </div>
                                {advertisement.moderationReason ? <div className="my-ad-moderation"><strong>Решение модерации:</strong> {advertisement.moderationReason}</div> : null}
                            </div>
                            <div className="my-ad-actions">
                                {["active", "needs_edit"].includes(status) ? <button className="primary" type="button" disabled={busy} onClick={() => setEditing(advertisement)}>Редактировать</button> : null}
                                {status === "expired" ? <button className="primary" type="button" disabled={busy} onClick={() => run(advertisement, extendAdvertisement)}>Продлить</button> : null}
                                <button className="danger" type="button" disabled={busy} onClick={() => window.confirm("Удалить объявление?") && run(advertisement, deleteAdvertisement)}>Удалить</button>
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
