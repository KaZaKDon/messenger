export default function Security() {
    return (
        <div className="settings-section">
            <h2>Безопасность</h2>

            <label className="settings-field">
                <span>Текущий пароль</span>
                <input type="password" placeholder="••••••••" />
            </label>

            <label className="settings-field">
                <span>Новый пароль</span>
                <input type="password" placeholder="••••••••" />
            </label>

            <label className="settings-field">
                <span>Подтверждение</span>
                <input type="password" placeholder="••••••••" />
            </label>

            <button type="button" className="settings-action">
                Обновить пароль
            </button>
        </div>
    );
}
