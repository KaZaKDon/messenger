import { useEffect, useMemo, useState } from "react";

const ADS_STORAGE_KEY = "myAnnouncements";
const PUBLISH_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function readAnnouncements() {
    try {
        const raw = localStorage.getItem(ADS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export default function MyAds() {
    const ads = useMemo(() => readAnnouncements(), []);
    const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());

    useEffect(() => {
        const timerId = setInterval(() => {
            setCurrentTimeMs(Date.now());
        }, 60_000);

        return () => clearInterval(timerId);
    }, []);

    return (
        <section className="settings-page">
            <header className="settings-header">
                <h1>Мои объявления</h1>
            </header>
            <div className="settings-panel">
                {ads.length === 0 ? <p>У вас пока нет опубликованных объявлений.</p> : null}
                {ads.map((ad) => {
                    const createdAt = new Date(ad.createdAt);
                    const expiresAt = new Date(createdAt.getTime() + PUBLISH_DAYS * DAY_MS);
                    const leftMs = expiresAt.getTime() - currentTimeMs;
                    const leftDays = Math.max(0, Math.ceil(leftMs / DAY_MS));
                    const isExpired = leftMs <= 0;

                    return (
                        <div key={ad.id} className="settings-list-item">
                            <div>
                                <strong>{ad.text || "Объявление без текста"}</strong>
                                <div>
                                    Размещено: {createdAt.toLocaleDateString()} •
                                    Завершение: {expiresAt.toLocaleDateString()}
                                </div>
                            </div>
                            <span>{isExpired ? "Срок истёк" : `${leftDays} дн.`}</span>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
