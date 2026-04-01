import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./settings.css";

const SETTINGS_ITEMS = [
    { id: "privacy", icon: "🔒", title: "Приватность" },
    { id: "notifications", icon: "🔔", title: "Уведомления" },
    { id: "appearance", icon: "🎨", title: "Внешний вид" },
    { id: "chat-media", icon: "🖼️", title: "Чаты и медиа" },
    { id: "calls", icon: "👥", title: "Звонки" },
];


export default function Settings() {
    const [openedItem, setOpenedItem] = useState(null);
    const navigate = useNavigate();

    const handleDeleteAccount = () => {
        const confirmed = window.confirm("Удалить аккаунт на этом устройстве?");
        if (!confirmed) return;

        sessionStorage.removeItem("currentUser");
        sessionStorage.removeItem("phone");
        navigate("/phone", { replace: true });
        window.location.reload();
    };


    return (
        <section className="settings-page">
            <header className="settings-header">
                <h1>Настройки</h1>
            </header>
            <div className="settings-panel">
                <ul className="settings-list" aria-label="Список настроек">
                    {SETTINGS_ITEMS.map((item) => (
                        <li key={item.id}>
                            <button
                                type="button"
                                className="settings-list-item"
                                onClick={() => setOpenedItem(item)}
                            >
                                <span className="settings-list-main">
                                    <span className="settings-list-icon" aria-hidden="true">
                                        {item.icon}
                                    </span>
                                    <span>{item.title}</span>
                                </span>
                                <span className="settings-list-arrow" aria-hidden="true">
                                    ›
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>

                <button type="button" className="settings-delete-btn" onClick={handleDeleteAccount}>
                    ⦿ Удалить аккаунт
                </button>
            </div>

            {openedItem ? (
                <div className="settings-modal-backdrop" role="presentation">
                    <div className="settings-modal" role="dialog" aria-modal="true">
                        <h2>{openedItem.title}</h2>
                        <div className="settings-modal-body" />
                        <button
                            type="button"
                            className="settings-action"
                            onClick={() => setOpenedItem(null)}
                        >
                            Сохранить
                        </button>
                    </div>
                </div>
            ) : null}

        </section>
    );
}
