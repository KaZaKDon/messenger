import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../../shared/config";
import AdminAdvertisementDetails from "./components/AdminAdvertisementDetails";
import { fetchManagedAdvertisements, moderateManagedAdvertisement } from "./advertisementAdminApi";
import {
    ADVERTISEMENT_STATUS_LABELS,
    advertisementCounters,
    advertisementGroupTitle,
    effectiveAdvertisementStatus,
    filterManagedAdvertisements,
    remainingPublicationLabel,
} from "./advertisementManagementModel";
import { useAdminSummaryContext } from "./adminSummaryContext";
import "./adminAdvertisements.css";

export default function AdminAdvertisements() {
    const [advertisements, setAdvertisements] = useState([]);
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");
    const [group, setGroup] = useState("all");
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");
    const { refresh: refreshSummary } = useAdminSummaryContext();

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try { setAdvertisements(await fetchManagedAdvertisements()); }
        catch (requestError) { setError(requestError.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const counters = useMemo(() => advertisementCounters(advertisements), [advertisements]);
    const visible = useMemo(
        () => filterManagedAdvertisements(advertisements, { query, status, group }),
        [advertisements, query, status, group],
    );
    const groups = useMemo(() => {
        const map = new Map();
        advertisements.forEach((advertisement) => map.set(advertisement.chatId, advertisementGroupTitle(advertisement)));
        return [...map.entries()].sort((left, right) => left[1].localeCompare(right[1], "ru"));
    }, [advertisements]);
    const selected = advertisements.find((advertisement) => advertisement.id === selectedId) ?? null;

    const moderate = async (nextStatus, reason) => {
        setProcessing(true);
        setError("");
        try {
            await moderateManagedAdvertisement(selected.id, nextStatus, reason);
            await Promise.all([load(), refreshSummary()]);
        } catch (requestError) { setError(requestError.message); }
        finally { setProcessing(false); }
    };

    const counterItems = [
        ["all", "Всего", counters.total],
        ["active", "Активные", counters.active],
        ["expired", "Истёкшие", counters.expired],
        ["removed", "Снятые", counters.removed],
        ["needs_edit", "На исправлении", counters.needs_edit],
    ];

    return (
        <section className="admin-scaffold-page admin-ads-page">
            <header className="admin-scaffold-header">
                <div><h1>Объявления</h1><p>Просмотр публикаций, сроки и решения модерации без физического удаления данных.</p></div>
                <button type="button" onClick={load} disabled={loading}>Обновить</button>
            </header>

            <div className="admin-ad-counters">
                {counterItems.map(([id, label, value]) => <button key={id} type="button" className={status === id ? "active" : ""} onClick={() => setStatus(id)}><span>{label}</span><strong>{loading ? "…" : value}</strong></button>)}
            </div>

            <div className="admin-ad-toolbar">
                <label><span>⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, автор, телефон или населённый пункт" /></label>
                <select value={group} onChange={(event) => setGroup(event.target.value)}><option value="all">Все группы</option>{groups.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select>
                <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Все статусы</option>{Object.entries(ADVERTISEMENT_STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
            </div>

            {error && !selected ? <p className="admin-ad-error" role="alert">{error}</p> : null}

            <div className="admin-ad-list">
                {visible.map((advertisement) => {
                    const actualStatus = effectiveAdvertisementStatus(advertisement);
                    return <button key={advertisement.id} type="button" className="admin-ad-card" onClick={() => { setError(""); setSelectedId(advertisement.id); }}>
                        <span className={`admin-ad-status status-${actualStatus}`}>{ADVERTISEMENT_STATUS_LABELS[actualStatus]}</span>
                        {advertisement.images?.[0]?.url ? <img src={`${advertisement.images[0].url.startsWith("http") ? "" : API_BASE_URL}${advertisement.images[0].url}`} alt="" /> : <span className="admin-ad-thumb">▧</span>}
                        <span className="admin-ad-card-copy"><strong>{advertisement.title}</strong><small>{advertisementGroupTitle(advertisement)} · {advertisement.settlement}</small><span>{advertisement.author?.name || "Без автора"} · {advertisement.author?.phone || "телефон не указан"}</span><em>{remainingPublicationLabel(advertisement)}</em></span>
                    </button>;
                })}
                {loading ? <p className="admin-ad-empty">Загрузка объявлений…</p> : null}
                {!loading && visible.length === 0 ? <p className="admin-ad-empty">Объявления не найдены.</p> : null}
            </div>

            {selected ? <AdminAdvertisementDetails key={`${selected.id}|${selected.status}|${selected.updatedAt}`} advertisement={selected} processing={processing} error={error} onModerate={moderate} onClose={() => !processing && setSelectedId(null)} /> : null}
        </section>
    );
}
