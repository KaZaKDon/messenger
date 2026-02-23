import { useState } from "react";

export default function SettingsProfile({ currentUser }) {
    const [name, setName] = useState(currentUser?.name ?? "");
    const [phone] = useState(currentUser?.phone ?? "");

    return (
        <div className="settings-section">
            <h2>Данные профиля</h2>

            <label className="settings-field">
                <span>Имя</span>
                <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>

            <label className="settings-field">
                <span>Телефон</span>
                <input value={phone} disabled />
            </label>

            <button type="button" className="settings-action">
                Сохранить изменения
            </button>
        </div>
    );
}
