import { NavLink } from "react-router-dom";
import logo from "../../screens/Phone/icon.jpg";
import "./AppSidebar.css";

const mutedItems = [
    { key: "my-ads", icon: "🧾", label: "Мои объявления" },
    { key: "calls", icon: "📞", label: "Звонки" },
    { key: "fav", icon: "⭐", label: "Избранное" },
    { key: "contacts", icon: "👥", label: "Контакты" },
].filter((item) => item.key !== "night");

export default function AppSidebar({
    currentUser,
    onDisabledClick,
    isNightMode = false,
    onNightModeChange,
}) {
    const name = currentUser?.name ?? "Пользователь";

    const toggleNightMode = () => {
        onNightModeChange?.(!isNightMode);
    };

    return (
        <aside className="app-sidebar">
            <div className="app-sidebar-top">
                <div className="app-brand">
                    <img src={logo} alt="Казачий круг" className="app-brand-logo" />
                    <div className="app-brand-title">КАЗАЧИЙ КРУГ</div>
                </div>

                <div className="app-current-user">
                    <img src={logo} alt="avatar" className="app-current-user-avatar" />
                    <div>
                        <div className="app-current-user-name">{name}</div>
                        <div className="app-current-user-status">онлайн</div>
                    </div>
                </div>

                <nav className="app-sidebar-nav">
                    <NavLink
                        to="/chat"
                        className={({ isActive }) =>
                            `app-sidebar-link ${isActive ? "active" : ""}`
                        }
                    >
                        <span>💬</span>
                        <span>Круг Чат</span>
                    </NavLink>

                    <NavLink
                        to="/profile"
                        className={({ isActive }) =>
                            `app-sidebar-link ${isActive ? "active" : ""}`
                        }
                    >
                        <span>👤</span>
                        <span>Мой профиль</span>
                    </NavLink>

                    {mutedItems.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            className="app-sidebar-link muted"
                            onClick={onDisabledClick}
                        >
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    ))}

                    <button
                        type="button"
                        className="app-sidebar-link night-mode-toggle"
                        onClick={toggleNightMode}
                        aria-pressed={isNightMode}
                        aria-label="Переключить ночной режим"
                    >
                        <span>🌙</span>
                        <span>Ночной режим</span>
                        <span className="night-mode-state">{isNightMode ? "Вкл" : "Выкл"}</span>
                        <span
                            className={`night-mode-check ${isNightMode ? "checked" : ""}`}
                            aria-hidden="true"
                        />
                    </button>
                </nav>
            </div>

            <div className="app-sidebar-bottom">
                <button
                    type="button"
                    className="app-sidebar-link muted"
                    onClick={onDisabledClick}
                >
                    <span>ℹ️</span>
                    <span>О приложении</span>
                </button>

                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        `app-sidebar-link ${isActive ? "active" : ""}`
                    }
                >
                    <span>⚙️</span>
                    <span>Настройки</span>
                </NavLink>
            </div>
        </aside>
    );
}
