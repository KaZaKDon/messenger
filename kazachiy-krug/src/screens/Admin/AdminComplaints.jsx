import { useCallback, useEffect, useMemo, useState } from "react";

import AdminComplaintDetails from "./components/AdminComplaintDetails";
import { fetchManagedComplaints, reviewManagedComplaint } from "./complaintAdminApi";
import {
    COMPLAINT_STATUS_LABELS,
    complaintCounters,
    complaintTargetTitle,
    filterManagedComplaints,
} from "./complaintManagementModel";
import { useAdminSummaryContext } from "./adminSummaryContext";
import "./adminComplaints.css";

export default function AdminComplaints() {
    const [complaints, setComplaints] = useState([]);
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");
    const { refresh: refreshSummary } = useAdminSummaryContext();

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try { setComplaints(await fetchManagedComplaints()); }
        catch (requestError) { setError(requestError.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const counters = useMemo(() => complaintCounters(complaints), [complaints]);
    const visible = useMemo(() => filterManagedComplaints(complaints, { query, status }), [complaints, query, status]);
    const selected = complaints.find((complaint) => complaint.id === selectedId) ?? null;

    const review = async (body) => {
        setProcessing(true);
        setError("");
        try {
            await reviewManagedComplaint(selected.id, body);
            await Promise.all([load(), refreshSummary()]);
        } catch (requestError) { setError(requestError.message); }
        finally { setProcessing(false); }
    };

    const counterItems = [
        ["all", "Всего", counters.total],
        ["new", "Новые", counters.new],
        ["in_review", "На рассмотрении", counters.in_review],
        ["resolved", "Решённые", counters.resolved],
        ["rejected", "Отклонённые", counters.rejected],
    ];

    return (
        <section className="admin-scaffold-page admin-complaints-page">
            <header className="admin-scaffold-header">
                <div><h1>Жалобы</h1><p>Очередь жалоб, снимки публикаций и решения модерации.</p></div>
                <button type="button" onClick={load} disabled={loading}>Обновить</button>
            </header>
            <div className="admin-complaint-counters">
                {counterItems.map(([id, label, value]) => <button key={id} type="button" className={status === id ? "active" : ""} onClick={() => setStatus(id)}><span>{label}</span><strong>{loading ? "…" : value}</strong></button>)}
            </div>
            <div className="admin-complaint-toolbar">
                <label><span>⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Причина, объявление, заявитель или группа" /></label>
                <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Все статусы</option>{Object.entries(COMPLAINT_STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
            </div>
            {error && !selected ? <p className="admin-complaint-error" role="alert">{error}</p> : null}
            <div className="admin-complaint-list">
                {visible.map((complaint) => (
                    <button key={complaint.id} type="button" className="admin-complaint-card" onClick={() => { setError(""); setSelectedId(complaint.id); }}>
                        <span className={`admin-complaint-status status-${complaint.status}`}>{COMPLAINT_STATUS_LABELS[complaint.status]}</span>
                        <strong>{complaintTargetTitle(complaint)}</strong>
                        <small>{complaint.targetSnapshot?.groupTitle || complaint.targetType}</small>
                        <span>{complaint.reason}</span>
                        <em>{complaint.reporter?.name || "Без заявителя"} · {new Date(complaint.createdAt).toLocaleString("ru-RU")}</em>
                    </button>
                ))}
                {loading ? <p className="admin-complaint-empty">Загрузка жалоб…</p> : null}
                {!loading && visible.length === 0 ? <p className="admin-complaint-empty">Жалобы не найдены.</p> : null}
            </div>
            {selected ? <AdminComplaintDetails key={`${selected.id}|${selected.status}|${selected.updatedAt}`} complaint={selected} processing={processing} error={error} onReview={review} onClose={() => !processing && setSelectedId(null)} /> : null}
        </section>
    );
}
