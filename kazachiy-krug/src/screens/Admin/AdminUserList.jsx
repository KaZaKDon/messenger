import { useCallback, useEffect, useMemo, useState } from "react";
import AdminUserDetails from "./components/AdminUserDetails";
import UserActionDialog from "./components/UserActionDialog";
import {
    blockManagedUser,
    deleteManagedUser,
    fetchManagedUsers,
    unblockManagedUser,
} from "./userAdminApi";
import {
    filterManagedUsers,
    USER_ROLE_LABELS,
    USER_STATUS_LABELS,
} from "./userManagementModel";
import { useAdminSummaryContext } from "./adminSummaryContext";
import "./adminUsers.css";

const INITIAL_DATA = {
    users: [],
    counts: { pending: 0, active: 0, rejected: 0, blocked: 0, deleted: 0 },
    total: 0,
};

export default function AdminUserList({ currentUser }) {
    const [data, setData] = useState(INITIAL_DATA);
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("all");
    const [selectedUser, setSelectedUser] = useState(null);
    const [pendingAction, setPendingAction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");
    const { refresh: refreshSummary } = useAdminSummaryContext();
    const role = currentUser?.role;

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setData(await fetchManagedUsers(role));
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    }, [role]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const visibleUsers = useMemo(
        () => filterManagedUsers(data.users, { query, status }),
        [data.users, query, status],
    );

    const startAction = (action, user) => {
        setPendingAction({ action, user });
    };

    const confirmAction = async (reason) => {
        if (!pendingAction) return;
        setProcessing(true);
        setError("");
        try {
            if (pendingAction.action === "block") {
                await blockManagedUser(pendingAction.user.id, reason);
            } else if (pendingAction.action === "unblock") {
                await unblockManagedUser(pendingAction.user.id);
            } else if (pendingAction.action === "delete") {
                await deleteManagedUser(pendingAction.user.id, reason);
            }
            setPendingAction(null);
            setSelectedUser(null);
            await Promise.all([loadUsers(), refreshSummary()]);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setProcessing(false);
        }
    };

    const counters = [
        { id: "all", label: "Всего", value: data.total },
        { id: "active", label: "Активные", value: data.counts.active },
        ...(role === "admin" ? [{ id: "pending", label: "Ожидают", value: data.counts.pending }] : []),
        { id: "blocked", label: "Заблокированы", value: data.counts.blocked },
    ];

    return (
        <div className="admin-user-list">
            <div className="admin-user-counters">
                {counters.map((counter) => (
                    <button
                        key={counter.id}
                        type="button"
                        className={status === counter.id || (counter.id === "all" && status === "all") ? "active" : ""}
                        onClick={() => setStatus(counter.id)}
                    >
                        <span>{counter.label}</span>
                        <strong>{loading ? "…" : counter.value}</strong>
                    </button>
                ))}
            </div>

            <div className="admin-user-toolbar">
                <label>
                    <span aria-hidden="true">⌕</span>
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={role === "admin" ? "Имя, телефон, email или логин" : "Имя или телефон"}
                    />
                </label>
                <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Статус пользователя">
                    <option value="all">Все статусы</option>
                    <option value="active">Активные</option>
                    {role === "admin" ? <option value="pending">Ожидают подтверждения</option> : null}
                    {role === "admin" ? <option value="rejected">Отклонённые</option> : null}
                    <option value="blocked">Заблокированные</option>
                    {role === "admin" ? <option value="deleted">Удалённые</option> : null}
                </select>
                <button type="button" onClick={loadUsers} disabled={loading}>Обновить</button>
            </div>

            {error ? <p className="admin-user-error" role="alert">{error}</p> : null}

            <div className="admin-user-table-wrap">
                <table className="admin-user-table">
                    <thead>
                        <tr>
                            <th>Пользователь</th>
                            <th>Контакты</th>
                            <th>Роль</th>
                            <th>Статус</th>
                            <th><span className="visually-hidden">Действия</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleUsers.map((user) => (
                            <tr key={user.id}>
                                <td data-label="Пользователь">
                                    <div className="admin-user-identity">
                                        <div className="admin-user-avatar">
                                            {user.avatar
                                                ? <img src={user.avatar} alt="" />
                                                : (user.name || "П").slice(0, 1).toUpperCase()}
                                        </div>
                                        <div>
                                            <strong>{user.name || "Без имени"}</strong>
                                            {user.login ? <small>@{user.login}</small> : null}
                                        </div>
                                    </div>
                                </td>
                                <td data-label="Контакты">
                                    <a href={`tel:${user.phone}`}>{user.phone || "—"}</a>
                                    {role === "admin" && user.email ? <small>{user.email}</small> : null}
                                </td>
                                <td data-label="Роль">{USER_ROLE_LABELS[user.role] ?? user.role}</td>
                                <td data-label="Статус">
                                    <span className={`admin-user-status status-${user.status}`}>
                                        {USER_STATUS_LABELS[user.status] ?? user.status}
                                    </span>
                                </td>
                                <td className="admin-user-row-action">
                                    <button type="button" onClick={() => setSelectedUser(user)}>Подробнее</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {!loading && visibleUsers.length === 0 ? (
                    <div className="admin-user-empty">
                        <strong>Пользователи не найдены</strong>
                        <span>Измените запрос или выбранный статус.</span>
                    </div>
                ) : null}
                {loading ? <div className="admin-user-loading">Загрузка пользователей…</div> : null}
            </div>

            <AdminUserDetails
                user={selectedUser}
                viewerRole={role}
                viewerId={currentUser?.id}
                onAction={startAction}
                onClose={() => setSelectedUser(null)}
            />

            {pendingAction ? (
                <UserActionDialog
                    key={`${pendingAction.action}-${pendingAction.user.id}`}
                    action={pendingAction.action}
                    user={pendingAction.user}
                    processing={processing}
                    onConfirm={confirmAction}
                    onClose={() => !processing && setPendingAction(null)}
                />
            ) : null}
        </div>
    );
}
