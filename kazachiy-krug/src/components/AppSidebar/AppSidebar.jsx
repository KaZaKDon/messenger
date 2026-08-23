import { useState, useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logoDark from "../../assets/branding/kazachiy-krug-kvk-simplified-dark.png";
import logoLight from "../../assets/branding/kazachiy-krug-kvk-detailed.png";
import { useContacts } from "../../shared/useContacts";
import { useSupportUnread } from "../../shared/useSupportUnread";
import { buildContactChatPath, filterContacts } from "../../shared/contactActions";
import { useUserBlocks } from "../../shared/useUserBlocks";
import "./AppSidebar.css";

export default function AppSidebar({
    currentUser,
    isNightMode = false,
    onNightModeChange,
    isOpen = false,
    onNavigate,
    personalUnreadCount = 0,

}) {
    const name = currentUser?.name ?? "Пользователь";
    const logo = isNightMode ? logoDark : logoLight;
    const avatar = currentUser?.avatar || logo;
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    const [isContactsOpen, setIsContactsOpen] = useState(false);
    const [contactsQuery, setContactsQuery] = useState("");
    const [selectedContact, setSelectedContact] = useState(null);
    const [contactsTab, setContactsTab] = useState("all");
    const { contacts } = useContacts(currentUser?.id)
    const { blockedUsers, blockedIds, block, unblock } = useUserBlocks(currentUser?.id);
    const supportUnread = useSupportUnread(currentUser?.id);
    const navigate = useNavigate();

    const handleNightModeToggle = () => {

        onNightModeChange?.(!isNightMode);
    };

    const goTo = (path) => {
        setIsContactsOpen(false);
        setIsAboutOpen(false);
        setContactsQuery("");
        setSelectedContact(null);
        navigate(path);
        onNavigate?.();
    };

    const filteredContacts = useMemo(() => {
        const source = contactsTab === "blocked"
            ? blockedUsers
            : contacts.filter((contact) => !blockedIds.has(contact.id));
        return filterContacts(source, contactsQuery);
    }, [blockedIds, blockedUsers, contacts, contactsQuery, contactsTab]);

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
                    <img src={avatar} alt="Аватар пользователя" className="app-current-user-avatar" />
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
                        {personalUnreadCount > 0 ? <span className="app-sidebar-badge">{personalUnreadCount}</span> : null}
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

                    <NavLink
                        to="/support-requests"
                        className={({ isActive }) => `app-sidebar-link ${isActive ? "active" : ""}`}
                        onClick={onNavigate}
                    >
                        <span>✉️</span>
                        <span>Обращения</span>
                        {supportUnread > 0 ? <span className="app-sidebar-badge">{supportUnread}</span> : null}
                    </NavLink>

                    <button
                        type="button"
                        className="app-sidebar-link"
                        onClick={() => {
                            setContactsQuery("");
                            setContactsTab("all");
                            setSelectedContact(null);
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

                    {currentUser?.role === "admin" || currentUser?.role === "moderator" ? (
                        <NavLink
                            to="/admin"
                            className="app-sidebar-link app-sidebar-admin-link"
                            onClick={onNavigate}
                        >
                            <span>🛡️</span>
                            <span>{currentUser.role === "admin" ? "В админку" : "В модерацию"}</span>
                        </NavLink>
                    ) : null}

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
                        setSelectedContact(null);
                        setIsContactsOpen(false);
                    }}
                >
                    <div
                        className="app-sidebar-about-modal"
                        role="dialog"
                        aria-modal="true"
                        onClick={(event) => event.stopPropagation()}
                    >
                        {selectedContact ? (
                            <div className="app-sidebar-contact-card">
                                <button type="button" className="app-sidebar-contact-back" onClick={() => setSelectedContact(null)}>
                                    ← Все контакты
                                </button>
                                <div className="app-sidebar-contact-avatar">
                                    {selectedContact.avatar ? <img src={selectedContact.avatar} alt="" /> : <span>{String(selectedContact.name || "?").slice(0, 1).toUpperCase()}</span>}
                                </div>
                                <h3>{selectedContact.name}</h3>
                                <a className="app-sidebar-contact-phone" href={`tel:${selectedContact.phone || ""}`}>
                                    {selectedContact.phone || "Телефон не указан"}
                                </a>
                                <div className="app-sidebar-contact-actions">
                                    {blockedIds.has(selectedContact.id) ? (
                                        <button type="button" className="app-sidebar-contact-unblock" onClick={async () => { await unblock(selectedContact.id); setSelectedContact(null); }}>Разблокировать</button>
                                    ) : (<>
                                        <button type="button" onClick={() => goTo(buildContactChatPath(selectedContact.id))}>💬 Написать</button>
                                        <button type="button" onClick={() => goTo(buildContactChatPath(selectedContact.id, "audio"))}>📞 Позвонить</button>
                                        <button type="button" onClick={() => goTo(buildContactChatPath(selectedContact.id, "video"))}>🎥 Видеозвонок</button>
                                        <button type="button" className="app-sidebar-contact-block" onClick={async () => {
                                            if (!window.confirm("Добавить пользователя в чёрный список?")) return;
                                            await block(selectedContact.id); setSelectedContact(null); setContactsTab("blocked");
                                        }}>Заблокировать</button>
                                    </>)}
                                </div>
                            </div>
                        ) : (
                            <>
                                <h3>Контакты</h3>
                                <div className="app-sidebar-contact-tabs">
                                    <button type="button" className={contactsTab === "all" ? "active" : ""} onClick={() => setContactsTab("all")}>Все контакты</button>
                                    <button type="button" className={contactsTab === "blocked" ? "active" : ""} onClick={() => setContactsTab("blocked")}>Чёрный список</button>
                                </div>
                                <input
                                    className="app-sidebar-contacts-search"
                                    placeholder="Поиск по нику или телефону"
                                    value={contactsQuery}
                                    onChange={(event) => setContactsQuery(event.target.value)}
                                />
                                {filteredContacts.length === 0 ? <p>{contactsTab === "blocked" ? "Чёрный список пуст." : "Контактов не найдено."}</p> : null}
                                {filteredContacts.map((contact) => (
                                    <button key={contact.id} type="button" className="app-sidebar-contact-row" onClick={() => setSelectedContact(contact)}>
                                        <span className="app-sidebar-contact-row-avatar">
                                            {contact.avatar ? <img src={contact.avatar} alt="" /> : String(contact.name || "?").slice(0, 1).toUpperCase()}
                                        </span>
                                        <span>
                                            <strong>{contact.name}</strong>
                                            <span className="app-sidebar-contact-subtitle">{contact.phone || "Телефон не указан"}</span>
                                        </span>
                                        <span aria-hidden="true">›</span>
                                    </button>
                                ))}
                            </>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setContactsQuery("");
                                setSelectedContact(null);
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
