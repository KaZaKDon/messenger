import { useState } from "react";
import Notifications from "./Notifications";
import SettingsProfile from "./Profile";
import Security from "./Security";
import "./settings.css";

const TABS = [
    { id: "profile", title: "Профиль" },
    { id: "security", title: "Безопасность" },
    { id: "notifications", title: "Уведомления" },
];

export default function Settings({ currentUser }) {
    const [activeTab, setActiveTab] = useState("profile");

    return (
        <section className="settings-page">
            <header className="settings-header">
                <h1>Настройки</h1>
                <p>Управление профилем и поведением приложения</p>
            </header>

            <div className="settings-tabs" role="tablist" aria-label="settings tabs">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.title}
                    </button>
                ))}
            </div>

            <div className="settings-panel">
                {activeTab === "profile" ? <SettingsProfile currentUser={currentUser} /> : null}
                {activeTab === "security" ? <Security /> : null}
                {activeTab === "notifications" ? <Notifications /> : null}
            </div>
        </section>
    );
}
