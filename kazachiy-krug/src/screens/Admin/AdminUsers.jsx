import { NavLink, Outlet, useLocation } from "react-router-dom";
import AdminUserList from "./AdminUserList";
import { useAdminSummaryContext } from "./adminSummaryContext";
import "./adminScaffold.css";

export default function AdminUsers({ currentUser }) {
    const location = useLocation();
    const { summary } = useAdminSummaryContext();
    const role = currentUser?.role;
    const isRoot = location.pathname === "/admin/users" || location.pathname === "/admin/users/";

    return (
        <section className="admin-scaffold-page admin-users-page">
            <header className="admin-scaffold-header">
                <div>
                    <h1>Пользователи</h1>
                    <p>Заявки, список аккаунтов, блокировка и мягкое удаление.</p>
                </div>
            </header>

            <nav className="admin-tabs" aria-label="Разделы пользователей">
                <NavLink end to="/admin/users">Все пользователи</NavLink>
                {role === "admin" ? (
                    <NavLink to="/admin/users/registrations">
                        Заявки
                        {(summary?.pendingRegistrations ?? 0) > 0
                            ? <strong>{summary.pendingRegistrations}</strong>
                            : null}
                    </NavLink>
                ) : null}
                {role === "admin" ? (
                    <NavLink to="/admin/users/password-recoveries">
                        Восстановление пароля
                        {(summary?.pendingPasswordRecoveries ?? 0) > 0
                            ? <strong>{summary.pendingPasswordRecoveries}</strong>
                            : null}
                    </NavLink>
                ) : null}
            </nav>

            {isRoot ? (
                <AdminUserList currentUser={currentUser} />
            ) : <Outlet />}
        </section>
    );
}
