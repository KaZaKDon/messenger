import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./settings.css";
import { API_BASE_URL } from "../../shared/config";
import { useNotificationPreferences } from "../../shared/useNotificationPreferences";
import { useUserBlocks } from "../../shared/useUserBlocks";
import {
    getBrowserNotificationPermission,
    requestBrowserNotificationPermission,
} from "../../shared/browserNotifications";

const SETTINGS_ITEMS = [
    { id: "privacy", icon: "🚫", title: "Чёрный список" },
    { id: "notifications", icon: "🔔", title: "Уведомления" },
];


export default function Settings({ currentUser }) {
    const [openedItem, setOpenedItem] = useState(null);
    const navigate = useNavigate();
    const { preferences, updatePreference } = useNotificationPreferences();
    const [browserPermission, setBrowserPermission] = useState(getBrowserNotificationPermission);
    const { blockedUsers, loading: blocksLoading, unblock } = useUserBlocks(currentUser?.id);

    const enableBrowserNotifications = async () => {
        const permission = await requestBrowserNotificationPermission();
        setBrowserPermission(permission);
    };

    const handleDeleteAccount = async () => {
        const confirmed = window.confirm("Выйти из аккаунта на этом устройстве?");
        if (!confirmed) return;

        const token = sessionStorage.getItem("accessToken");
        if (token) {
            try {
                await fetch(`${API_BASE_URL}/auth/logout`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                });
            } catch {
                // The local session must still be removed when the server is unavailable.
            }
        }
        sessionStorage.removeItem("currentUser");
        sessionStorage.removeItem("accessToken");
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
                                onClick={() => setOpenedItem(item.id)}
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
                    ⦿ Выйти из аккаунта
                </button>
            </div>

            {openedItem ? (
                <div className="settings-modal-backdrop" role="presentation" onClick={() => setOpenedItem(null)}>
                    <div className="settings-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
                        <div className="settings-modal-heading">
                            <h2>{openedItem === "privacy" ? "Чёрный список" : "Уведомления"}</h2>
                            <button type="button" onClick={() => setOpenedItem(null)} aria-label="Закрыть">✕</button>
                        </div>
                        {openedItem === "notifications" ? (
                            <div className="settings-options">
                                <div className="settings-browser-permission">
                                    <span>
                                        <strong>Системные уведомления браузера</strong>
                                        <small>
                                            {browserPermission === "granted" ? "Разрешены" : null}
                                            {browserPermission === "default" ? "Требуется разрешение браузера" : null}
                                            {browserPermission === "denied" ? "Заблокированы в настройках браузера" : null}
                                            {browserPermission === "unsupported" ? "Не поддерживаются этим браузером" : null}
                                        </small>
                                    </span>
                                    {browserPermission === "default" ? (
                                        <button type="button" onClick={enableBrowserNotifications}>Разрешить</button>
                                    ) : null}
                                </div>
                                <label>
                                    <span><strong>Уведомления о сообщениях</strong><small>Без показа текста сообщения</small></span>
                                    <input
                                        type="checkbox"
                                        checked={preferences.messageBrowser}
                                        disabled={browserPermission !== "granted"}
                                        onChange={(event) => updatePreference("messageBrowser", event.target.checked)}
                                    />
                                </label>
                                <label>
                                    <span><strong>Уведомления о звонках</strong><small>Имя звонящего без лишних данных</small></span>
                                    <input
                                        type="checkbox"
                                        checked={preferences.callBrowser}
                                        disabled={browserPermission !== "granted"}
                                        onChange={(event) => updatePreference("callBrowser", event.target.checked)}
                                    />
                                </label>
                                <label>
                                    <span><strong>Звук личных сообщений</strong><small>Сигнал только для личного чата</small></span>
                                    <input type="checkbox" checked={preferences.messageSound} onChange={(event) => updatePreference("messageSound", event.target.checked)} />
                                </label>
                                <label>
                                    <span><strong>Звук входящего звонка</strong><small>Для аудио- и видеозвонков</small></span>
                                    <input type="checkbox" checked={preferences.callSound} onChange={(event) => updatePreference("callSound", event.target.checked)} />
                                </label>
                            </div>
                        ) : (
                            <div className="settings-blocked-list">
                                <p>Личный чёрный список</p>
                                {blocksLoading ? <span>Загрузка...</span> : null}
                                {!blocksLoading && blockedUsers.length === 0 ? <span>Чёрный список пуст.</span> : null}
                                {blockedUsers.map((user) => (
                                    <div key={user.id} className="settings-blocked-row">
                                        <span><strong>{user.name}</strong><small>{user.phone}</small></span>
                                        <button type="button" onClick={() => unblock(user.id)}>Разблокировать</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

        </section>
    );
}
