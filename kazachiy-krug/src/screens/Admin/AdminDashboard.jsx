import { Link } from "react-router-dom";
import { getAdminNavigation } from "./adminNavigation";
import { useAdminSummaryContext } from "./adminSummaryContext";
import "./adminScaffold.css";

const SUMMARY_KEYS = {
    users: "users",
    groups: "groups",
    advertisements: "advertisements",
    complaints: "complaints",
    support: "supportRequests",
    payments: "payments",
    moderators: "moderators",
};

function formatValue(value, loading) {
    if (loading) return "…";
    return value === null || value === undefined ? "—" : value;
}

export default function AdminDashboard({ role }) {
    const { summary, loading, error, refresh } = useAdminSummaryContext();
    const navigation = getAdminNavigation(role).filter((item) => item.id !== "overview");

    return (
        <section className="admin-scaffold-page">
            <header className="admin-scaffold-header">
                <div>
                    <span className="admin-scaffold-eyebrow">КАЗАЧИЙ КРУГ</span>
                    <h1>{role === "admin" ? "Обзор админки" : "Обзор модерации"}</h1>
                    <p>Текущее состояние пользователей и очередей, требующих внимания.</p>
                </div>
                <button type="button" onClick={refresh} disabled={loading}>Обновить</button>
            </header>

            {error ? <p className="admin-scaffold-error" role="alert">{error}</p> : null}

            <div className="admin-dashboard-grid">
                {navigation.map((item) => {
                    const key = SUMMARY_KEYS[item.id];
                    const value = key ? summary?.[key] : null;
                    const note = item.id === "users" && summary?.pendingRegistrations !== null
                        ? `${(summary?.pendingRegistrations ?? 0) + (summary?.pendingPasswordRecoveries ?? 0)} новых заявок`
                        : item.id === "users" && summary?.blockedUsers
                            ? `${summary.blockedUsers} заблокировано`
                            : item.id === "groups" && value == null
                                ? "Счётчик подключим с управлением группами"
                                : "Открыть раздел";

                    return (
                        <Link key={item.id} to={item.path} className="admin-dashboard-card">
                            <span className="admin-dashboard-card-icon" aria-hidden="true">{item.icon}</span>
                            <span className="admin-dashboard-card-value">{formatValue(value, loading)}</span>
                            <strong>{item.label}</strong>
                            <small>{note}</small>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
