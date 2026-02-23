import { useState } from "react";

export default function Notifications() {
    const [telegram, setTelegram] = useState(true);
    const [email, setEmail] = useState(false);
    const [muteNight, setMuteNight] = useState(true);

    return (
        <div className="settings-section">
            <h2>Уведомления</h2>

            <label className="settings-toggle">
                <input
                    type="checkbox"
                    checked={telegram}
                    onChange={(event) => setTelegram(event.target.checked)}
                />
                <span>Получать push-уведомления</span>
            </label>

            <label className="settings-toggle">
                <input
                    type="checkbox"
                    checked={email}
                    onChange={(event) => setEmail(event.target.checked)}
                />
                <span>Дублировать уведомления на email</span>
            </label>

            <label className="settings-toggle">
                <input
                    type="checkbox"
                    checked={muteNight}
                    onChange={(event) => setMuteNight(event.target.checked)}
                />
                <span>Тихий режим с 23:00 до 08:00</span>
            </label>
        </div>
    );
}
