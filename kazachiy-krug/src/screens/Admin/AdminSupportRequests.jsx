import { useCallback, useEffect, useMemo, useState } from "react";

import { filterSupportRequests, supportCounters, SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_LABELS } from "../../shared/supportRequestModel";
import AdminSupportRequestDetails from "./components/AdminSupportRequestDetails";
import { useAdminSummaryContext } from "./adminSummaryContext";
import { answerManagedSupportRequest, closeManagedSupportRequest, fetchManagedSupportRequests, startManagedSupportRequest } from "./supportRequestAdminApi";
import "./adminSupportRequests.css";

export default function AdminSupportRequests() {
    const [requests, setRequests] = useState([]);
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");
    const { refresh: refreshSummary } = useAdminSummaryContext();

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try { setRequests(await fetchManagedSupportRequests()); }
        catch (requestError) { setError(requestError.message); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const counters = useMemo(() => supportCounters(requests), [requests]);
    const visible = useMemo(() => filterSupportRequests(requests, query, status), [requests, query, status]);
    const selected = requests.find((request) => request.id === selectedId) ?? null;

    const run = async (action) => {
        setProcessing(true); setError("");
        try { await action(); await Promise.all([load(), refreshSummary()]); }
        catch (requestError) { setError(requestError.message); }
        finally { setProcessing(false); }
    };

    const items = [["all", "Всего", counters.total], ["new", "Новые", counters.new], ["in_progress", "В работе", counters.in_progress], ["answered", "С ответом", counters.answered], ["closed", "Закрытые", counters.closed]];
    return (
        <section className="admin-scaffold-page admin-support-page">
            <header className="admin-scaffold-header"><div><h1>Обращения</h1><p>Официальные письма пользователей и ответы администрации.</p></div><button type="button" onClick={load} disabled={loading}>Обновить</button></header>
            <div className="admin-support-counters">{items.map(([id, label, value]) => <button key={id} type="button" className={status === id ? "active" : ""} onClick={() => setStatus(id)}><span>{label}</span><strong>{loading ? "…" : value}</strong></button>)}</div>
            <div className="admin-support-toolbar"><label><span>⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Тема, категория, имя или телефон" /></label><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Все статусы</option>{Object.entries(SUPPORT_STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            {error && !selected ? <p className="admin-support-error">{error}</p> : null}
            <div className="admin-support-list">
                {visible.map((request) => <button key={request.id} type="button" className="admin-support-card" onClick={() => { setSelectedId(request.id); setError(""); }}><span className={`admin-support-status status-${request.status}`}>{SUPPORT_STATUS_LABELS[request.status]}</span><strong>{request.subject}</strong><small>{SUPPORT_CATEGORY_LABELS[request.category] || "Другое"}</small><span>{request.author?.name || "—"} · {request.author?.phone || "телефон не указан"}</span><em>{request.assignedTo?.name ? `Ответственный: ${request.assignedTo.name}` : "Не взято в работу"}</em></button>)}
                {loading ? <p className="admin-support-empty">Загрузка обращений…</p> : null}{!loading && visible.length === 0 ? <p className="admin-support-empty">Обращения не найдены.</p> : null}
            </div>
            {selected ? <AdminSupportRequestDetails key={`${selected.id}|${selected.status}|${selected.updatedAt}`} request={selected} processing={processing} error={error} onStart={() => run(() => startManagedSupportRequest(selected.id))} onAnswer={(text) => run(() => answerManagedSupportRequest(selected.id, text))} onCloseRequest={() => run(() => closeManagedSupportRequest(selected.id))} onClose={() => !processing && setSelectedId(null)} /> : null}
        </section>
    );
}
