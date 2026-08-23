import { useCallback, useEffect, useMemo, useState } from "react";
import AdminGroupDetails from "./components/AdminGroupDetails";
import GroupCreateDialog from "./components/GroupCreateDialog";
import {
    changeGroupStatus,
    clearPaidGroupOwner,
    createGroup,
    fetchManagedGroups,
    setGroupAssignment,
    setPaidGroupOwner,
    updateGroup,
} from "./groupAdminApi";
import {
    GROUP_POLICY_LABELS,
    GROUP_STATUS_LABELS,
    GROUP_VISIBILITY_LABELS,
    filterManagedGroups,
    groupCounters,
    groupKindLabel,
} from "./groupManagementModel";
import { useAdminSummaryContext } from "./adminSummaryContext";
import "./adminGroups.css";

export default function AdminGroups({ currentUser }) {
    const [data, setData] = useState({ groups: [], total: 0, candidates: [] });
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");
    const [selectedId, setSelectedId] = useState(null);
    const [creating, setCreating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");
    const { refresh: refreshSummary } = useAdminSummaryContext();
    const isAdmin = currentUser?.role === "admin";

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setData(await fetchManagedGroups());
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const selected = data.groups.find((group) => group.chatId === selectedId) ?? null;
    const visibleGroups = useMemo(
        () => filterManagedGroups(data.groups, { query, status }),
        [data.groups, query, status],
    );
    const counters = useMemo(() => groupCounters(data.groups), [data.groups]);

    const run = async (operation, { close = false } = {}) => {
        setProcessing(true);
        setError("");
        try {
            await operation();
            if (close) setSelectedId(null);
            await Promise.all([load(), refreshSummary()]);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setProcessing(false);
        }
    };

    const create = (source) => run(async () => {
        const result = await createGroup(source);
        setCreating(false);
        setSelectedId(result.group.chatId);
    });

    return (
        <section className="admin-scaffold-page admin-groups-page">
            <header className="admin-scaffold-header">
                <div>
                    <h1>Группы</h1>
                    <p>Видимость, публикация, участники, выбранные авторы и договорные владельцы.</p>
                </div>
                {isAdmin ? <button type="button" onClick={() => { setError(""); setCreating(true); }}>+ Добавить группу</button> : null}
            </header>

            <div className="admin-group-counters">
                {[
                    ["all", "Всего", counters.total],
                    ["active", "Активные", counters.active],
                    ["private", "Закрытые", counters.private],
                    ["disabled", "Отключены / архив", counters.disabled],
                ].map(([id, label, value]) => (
                    <button
                        key={id}
                        type="button"
                        className={status === id ? "active" : ""}
                        onClick={() => setStatus(id)}
                    >
                        <span>{label}</span><strong>{loading ? "…" : value}</strong>
                    </button>
                ))}
            </div>

            <div className="admin-group-toolbar">
                <label><span>⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название, тип или идентификатор" /></label>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="all">Все состояния</option>
                    <option value="private">Только закрытые</option>
                    <option value="active">Активные</option>
                    <option value="disabled">Отключённые</option>
                    <option value="archived">Архивные</option>
                </select>
                <button type="button" onClick={load} disabled={loading}>Обновить</button>
            </div>

            {error ? <p className="admin-group-error" role="alert">{error}</p> : null}

            <div className="admin-group-list">
                {visibleGroups.map((group) => (
                    <button key={group.chatId} type="button" className="admin-group-card" onClick={() => { setError(""); setSelectedId(group.chatId); }}>
                        <span className={`admin-group-card-status status-${group.status}`}>{GROUP_STATUS_LABELS[group.status]}</span>
                        <strong>{group.title}</strong>
                        <small>{groupKindLabel(group)} · {GROUP_VISIBILITY_LABELS[group.visibility]}</small>
                        <dl>
                            <div><dt>Публикация</dt><dd>{GROUP_POLICY_LABELS[group.publishPolicy]}</dd></div>
                            {group.visibility === "private" ? <div><dt>Участников</dt><dd>{group.members?.length ?? 0}</dd></div> : null}
                            {group.publishPolicy === "selected_authors" ? <div><dt>Авторов</dt><dd>{group.publishers?.length ?? 0}</dd></div> : null}
                            {group.publishPolicy === "owner" ? <div><dt>Владелец</dt><dd>{group.owner?.name || "не назначен"}</dd></div> : null}
                        </dl>
                    </button>
                ))}
                {loading ? <p className="admin-group-empty">Загрузка групп…</p> : null}
                {!loading && visibleGroups.length === 0 ? <p className="admin-group-empty">Группы не найдены.</p> : null}
            </div>

            {selected ? (
                <AdminGroupDetails
                    key={[
                        selected.chatId,
                        selected.title,
                        selected.status,
                        selected.mode,
                        selected.contentType,
                        selected.visibility,
                        selected.publishPolicy,
                        selected.owner?.id,
                        selected.members?.length,
                        selected.publishers?.length,
                    ].join("|")}
                    group={selected}
                    currentUser={currentUser}
                    candidates={data.candidates}
                    processing={processing}
                    error={error}
                    onSave={(source) => run(() => updateGroup(selected.chatId, source))}
                    onStatus={(nextStatus, reason) => run(() => changeGroupStatus(selected.chatId, nextStatus, reason))}
                    onAssignment={(kind, userId, assigned) => run(() => setGroupAssignment(selected.chatId, kind, userId, assigned))}
                    onSetOwner={(source) => run(() => setPaidGroupOwner(selected.chatId, source))}
                    onClearOwner={(reason) => run(() => clearPaidGroupOwner(selected.chatId, reason))}
                    onClose={() => !processing && setSelectedId(null)}
                />
            ) : null}

            {creating ? (
                <GroupCreateDialog
                    processing={processing}
                    error={error}
                    onCreate={create}
                    onClose={() => !processing && setCreating(false)}
                />
            ) : null}
        </section>
    );
}
