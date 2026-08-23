import { useCallback, useEffect, useMemo, useState } from "react";

import { useAdminSummaryContext } from "./adminSummaryContext";
import {
    assignModerator,
    blockModerator,
    fetchModerators,
    removeModerator,
    unblockModerator,
} from "./moderatorAdminApi";
import {
    canAssignModerator,
    canRemoveModerator,
    filterModeratorUsers,
    moderatorCounters,
} from "./moderatorManagementModel";
import "./adminModerators.css";

function Avatar({ user }) {
    return <span className="admin-moderator-avatar">{user.avatar ? <img src={user.avatar} alt="" /> : (user.name || "?").slice(0, 1).toUpperCase()}</span>;
}

export default function AdminModerators({ currentUser }) {
    const [data, setData] = useState({ moderators: [], candidates: [] });
    const [tab, setTab] = useState("moderators");
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [error, setError] = useState("");
    const { refresh: refreshSummary } = useAdminSummaryContext();

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try { setData(await fetchModerators()); }
        catch (requestError) { setError(requestError.message); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const counters = useMemo(() => moderatorCounters(data), [data]);
    const visible = useMemo(() => filterModeratorUsers(
        tab === "moderators" ? data.moderators : data.candidates,
        query,
    ), [data, query, tab]);

    const run = async (userId, action) => {
        setProcessingId(userId); setError("");
        try { await action(); await Promise.all([load(), refreshSummary()]); }
        catch (requestError) { setError(requestError.message); }
        finally { setProcessingId(null); }
    };

    const appoint = (user) => {
        if (!window.confirm(`Назначить ${user.name || user.phone} модератором? Все текущие сессии пользователя будут завершены.`)) return;
        run(user.id, () => assignModerator(user.id));
    };
    const remove = (user) => {
        if (!window.confirm(`Снять роль модератора у ${user.name || user.phone}? Аккаунт останется обычным пользовательским.`)) return;
        run(user.id, () => removeModerator(user.id));
    };
    const block = (user) => {
        const reason = window.prompt("Укажите причину блокировки модератора:", "");
        if (reason === null) return;
        run(user.id, () => blockModerator(user.id, reason));
    };
    const unblock = (user) => {
        if (!window.confirm(`Разблокировать ${user.name || user.phone}?`)) return;
        run(user.id, () => unblockModerator(user.id));
    };

    return (
        <section className="admin-scaffold-page admin-moderators-page">
            <header className="admin-scaffold-header"><div><h1>Модераторы</h1><p>Назначение и снятие глобальной роли. После изменения роли пользователь входит заново.</p></div><button type="button" onClick={load} disabled={loading}>Обновить</button></header>
            <div className="admin-moderator-counters">
                <div><span>Всего модераторов</span><strong>{loading ? "…" : counters.total}</strong></div>
                <div><span>Активные</span><strong>{loading ? "…" : counters.active}</strong></div>
                <div><span>Заблокированные</span><strong>{loading ? "…" : counters.blocked}</strong></div>
                <div><span>Можно назначить</span><strong>{loading ? "…" : counters.candidates}</strong></div>
            </div>
            <div className="admin-moderator-tabs"><button type="button" className={tab === "moderators" ? "active" : ""} onClick={() => { setTab("moderators"); setQuery(""); }}>Модераторы <strong>{counters.total}</strong></button><button type="button" className={tab === "candidates" ? "active" : ""} onClick={() => { setTab("candidates"); setQuery(""); }}>Назначить <strong>{counters.candidates}</strong></button></div>
            <label className="admin-moderator-search"><span>⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя, телефон, email или логин" /></label>
            {error ? <p className="admin-moderator-error" role="alert">{error}</p> : null}
            <div className="admin-moderator-list">
                {visible.map((user) => {
                    const processing = processingId === user.id;
                    return <article key={user.id} className="admin-moderator-card"><Avatar user={user} /><div className="admin-moderator-main"><strong>{user.name || "Без имени"}</strong><span>{user.phone || "Телефон не указан"}</span><small>{user.email || (user.login ? `@${user.login}` : "Дополнительных контактов нет")}</small></div><span className={`admin-moderator-status status-${user.status}`}>{user.status === "active" ? "Активен" : "Заблокирован"}</span><div className="admin-moderator-actions">{tab === "candidates" ? <button type="button" className="primary" disabled={processing || !canAssignModerator(user)} onClick={() => appoint(user)}>Назначить модератором</button> : <>{user.status === "active" ? <button type="button" disabled={processing} onClick={() => block(user)}>Заблокировать</button> : <button type="button" disabled={processing} onClick={() => unblock(user)}>Разблокировать</button>}<button type="button" className="danger" disabled={processing || !canRemoveModerator(user, currentUser.id)} onClick={() => remove(user)}>Снять роль</button></>}</div></article>;
                })}
                {!loading && visible.length === 0 ? <p className="admin-moderator-empty">Ничего не найдено.</p> : null}
                {loading ? <p className="admin-moderator-empty">Загрузка…</p> : null}
            </div>
        </section>
    );
}
