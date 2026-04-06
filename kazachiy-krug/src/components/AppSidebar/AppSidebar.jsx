import { useState, useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../../screens/Phone/icon.jpg";
import { useContacts } from "../../shared/useContacts";
import "./AppSidebar.css";

export default function AppSidebar({
    currentUser,
    isNightMode = false,
    onNightModeChange,
    isOpen = false,
    onNavigate,

}) {
    const name = currentUser?.name ?? "Пользователь";
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    const [isContactsOpen, setIsContactsOpen] = useState(false);
    const [contactsQuery, setContactsQuery] = useState("");
    const { contacts } = useContacts(currentUser?.id)
    const navigate = useNavigate();

    const handleNightModeToggle = () => {

        onNightModeChange?.(!isNightMode);
    };

    const goTo = (path) => {
        setIsContactsOpen(false);
        setIsAboutOpen(false);
        setContactsQuery("");
        navigate(path);
        onNavigate?.();
    };

    const filteredContacts = useMemo(() => {
        const q = contactsQuery.trim().toLowerCase();
        if (!q) return contacts;

        return contacts.filter((contact) => {
            const name = String(contact?.name ?? "").toLowerCase();
            const id = String(contact?.id ?? "").toLowerCase();
            const phone = String(contact?.phone ?? "").toLowerCase();
            return name.includes(q) || id.includes(q) || phone.includes(q);
        });
    }, [contacts, contactsQuery]);

    return (
        <aside className={`app-sidebar ${isOpen ? "open" : ""}`}>
            <button
                type="button"
                className="app-sidebar-close"
                onClick={onNavigate}
                aria-label="Закрыть меню"
            >
                ✕
            </button>
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
                        onClick={onNavigate}
                    >
                        <span>💬</span>
                        <span>Круг Чат</span>
                    </NavLink>

                    <NavLink
                        to="/calls"
                        className={({ isActive }) =>
                            `app-sidebar-link ${isActive ? "active" : ""}`
                        }
                        onClick={onNavigate}
                    >
                        <span>📞</span>
                        <span>Звонки</span>
                    </NavLink>

                    <button
                        type="button"
                        className="app-sidebar-link"
                        onClick={() => goTo("/my-ads")}
                    >
                        <span>🧾</span>
                        <span>Мои объявления</span>
                    </button>

                    <button
                        type="button"
                        className="app-sidebar-link"
                        onClick={() => goTo("/favorites")}
                    >
                        <span>⭐</span>
                        <span>Избранное</span>
                    </button>

                    <button
                        type="button"
                        className="app-sidebar-link"
                        onClick={() => {
                            setContactsQuery("");
                            setIsContactsOpen(true);
                        }}
                    >
                        <span>👥</span>
                        <span>Контакты</span>
                    </button>

                    <NavLink
                        to="/profile"
                        className={({ isActive }) =>
                            `app-sidebar-link ${isActive ? "active" : ""}`
                        }
                        onClick={onNavigate}
                    >
                        <span>👤</span>
                        <span>Мой профиль</span>
                    </NavLink>

                    <button
                        type="button"
                        className="app-sidebar-link night-mode-toggle"
                        onClick={handleNightModeToggle}

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
                    className="app-sidebar-link"
                    onClick={() => setIsAboutOpen(true)}
                >

                    <span>ℹ️</span>
                    <span>О приложении</span>
                </button>

                <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                        `app-sidebar-link ${isActive ? "active" : ""}`
                    }
                    onClick={onNavigate}
                >
                    <span>⚙️</span>
                    <span>Настройки</span>
                </NavLink>
            </div>

            {isAboutOpen ? (
                <div className="app-sidebar-about-overlay" role="presentation" onClick={() => setIsAboutOpen(false)}>
                    <div
                        className="app-sidebar-about-modal"
                        role="dialog"
                        aria-modal="true"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h3>О приложении</h3>
                        <p>Казачий Круг — мессенджер для кругов, объявлений и контактов.</p>
                        <p>Разработчик: KaZaKDon.</p>
                        <a href="https://t.me/" target="_blank" rel="noreferrer">Telegram</a>
                        <a href="https://github.com/" target="_blank" rel="noreferrer">Портфолио</a>
                        <button type="button" onClick={() => setIsAboutOpen(false)}>Закрыть</button>
                    </div>
                </div>
            ) : null}

            {isContactsOpen ? (
                <div
                    className="app-sidebar-about-overlay"
                    role="presentation"
                    onClick={() => {
                        setContactsQuery("");
                        setIsContactsOpen(false);
                    }}
                >
                    <div
                        className="app-sidebar-about-modal"
                        role="dialog"
                        aria-modal="true"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h3>Контакты</h3>
                        <input
                            className="app-sidebar-contacts-search"
                            placeholder="Поиск контакта..."
                            value={contactsQuery}
                            onChange={(event) => setContactsQuery(event.target.value)}
                        />
                        {filteredContacts.length === 0 ? <p>Контактов не найдено.</p> : null}
                        {filteredContacts.map((contact) => (
                            <div key={contact.id} className="app-sidebar-contact-row">
                                <div>
                                    <div>{contact.name}</div>
                                    <div className="app-sidebar-contact-subtitle">
                                        {contact.phone || contact.id}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => goTo(`/chat?user=${encodeURIComponent(contact.id)}`)}
                                >
                                    Написать
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => {
                                setContactsQuery("");
                                setIsContactsOpen(false);
                            }}
                        >
                            Закрыть
                        </button>
                    </div>
                </div>
            ) : null}
        </aside>
    );
}
