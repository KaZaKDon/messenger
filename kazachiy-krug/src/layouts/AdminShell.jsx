import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import logoDark from "../assets/branding/kazachiy-krug-kvk-simplified-dark.png";
import logoLight from "../assets/branding/kazachiy-krug-kvk-detailed.png";
import { API_BASE_URL } from "../shared/config";
import {
    getAdminNavigation,
    getAdminPageTitle,
} from "../screens/Admin/adminNavigation";
import { AdminSummaryContext } from "../screens/Admin/adminSummaryContext";
import { useAdminSummary } from "../screens/Admin/useAdminSummary";
import "./AdminShell.css";

export default function AdminShell({
    currentUser,
    setCurrentUser,
    isNightMode,
    setIsNightMode,
}) {
    const location = useLocation();
    const navigate = useNavigate();
    const role = currentUser?.role;
    const navigation = getAdminNavigation(role);
    const summaryState = useAdminSummary(role);
    const isMenuRoot = location.pathname === "/admin" || location.pathname === "/admin/";
    const pageTitle = getAdminPageTitle(location.pathname, role);
    const logo = isNightMode ? logoDark : logoLight;
    const roleTitle = role === "admin" ? "Админка" : "Модерация";

    const logout = async () => {
        const token = sessionStorage.getItem("accessToken");
        try {
            await fetch(`${API_BASE_URL}/auth/logout`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
            });
        } catch {
            // Локальная сессия должна закрываться даже при недоступном сервере.
        } finally {
            sessionStorage.removeItem("accessToken");
            sessionStorage.removeItem("currentUser");
            setCurrentUser(null);
            navigate("/phone", { replace: true });
        }
    };

    return (
        <AdminSummaryContext.Provider value={summaryState}>
            <div className={`admin-shell ${isMenuRoot ? "admin-shell-menu-root" : ""}`}>
                <aside className="admin-shell-sidebar">
                    <div className="admin-shell-brand">
                        <img src={logo} alt="Казачий круг" />
                        <div>
                            <strong>КАЗАЧИЙ КРУГ</strong>
                            <span>{roleTitle}</span>
                        </div>
                    </div>

                    <div className="admin-shell-user">
                        <div className="admin-shell-user-avatar">
                            {(currentUser?.name || "К").slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                            <strong>{currentUser?.name || "Пользователь"}</strong>
                            <span>{role === "admin" ? "Администратор" : "Модератор"}</span>
                        </div>
                    </div>

                    <nav className="admin-shell-nav" aria-label="Разделы админки">
                        {navigation.map((item) => {
                            const badge = item.id === "users"
                                ? (summaryState.summary?.pendingRegistrations ?? 0)
                                    + (summaryState.summary?.pendingPasswordRecoveries ?? 0)
                                : null;

                            return (
                                <NavLink
                                    key={item.id}
                                    to={item.path}
                                    className={({ isActive }) =>
                                        `admin-shell-nav-link ${isActive ? "active" : ""}`
                                    }
                                >
                                    <span className="admin-shell-nav-icon" aria-hidden="true">{item.icon}</span>
                                    <span>{item.label}</span>
                                    {badge > 0 ? <strong className="admin-shell-badge">{badge}</strong> : null}
                                    <span className="admin-shell-nav-arrow" aria-hidden="true">›</span>
                                </NavLink>
                            );
                        })}
                    </nav>

                    <div className="admin-shell-sidebar-footer">
                        <button type="button" onClick={() => setIsNightMode(!isNightMode)}>
                            <span aria-hidden="true">{isNightMode ? "☀" : "☾"}</span>
                            {isNightMode ? "Светлый режим" : "Ночной режим"}
                        </button>
                        <button type="button" onClick={() => navigate("/chat")}>
                            <span aria-hidden="true">←</span>
                            В Круг
                        </button>
                        <button type="button" className="admin-shell-logout" onClick={logout}>
                            <span aria-hidden="true">⇥</span>
                            Выйти
                        </button>
                    </div>
                </aside>

                <main className="admin-shell-content">
                    <header className="admin-shell-mobile-header">
                        <button type="button" onClick={() => navigate("/admin")} aria-label="Назад к меню">
                            ←
                        </button>
                        <strong>{pageTitle}</strong>
                        <button type="button" onClick={() => navigate("/chat")} aria-label="Вернуться в Круг">
                            В Круг
                        </button>
                    </header>
                    <Outlet />
                </main>
            </div>
        </AdminSummaryContext.Provider>
    );
}
