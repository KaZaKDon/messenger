import { useMemo } from "react";
import { useContacts } from "../../shared/useContacts";

const FAVORITES_KEY = "favoriteContacts";

function readFavorites() {
    try {
        const raw = localStorage.getItem(FAVORITES_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeFavorites(next) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
}

export default function Contacts() {
    const { contacts, loading } = useContacts();
    const favoriteIds = useMemo(() => new Set(readFavorites()), []);

    const toggleFavorite = (contactId) => {
        const current = readFavorites();
        const exists = current.includes(contactId);
        const next = exists
            ? current.filter((id) => id !== contactId)
            : [...current, contactId];
        writeFavorites(next);
        window.location.reload();
    };

    return (
        <section className="settings-page">
            <header className="settings-header">
                <h1>Контакты</h1>
            </header>
            <div className="settings-panel">
                {loading ? <p>Загружаем контакты...</p> : null}
                {!loading && contacts.length === 0 ? <p>Контакты не найдены.</p> : null}
                {contacts.map((contact) => (
                    <div key={contact.id} className="settings-list-item">
                        <span>{contact.name}</span>
                        <button type="button" onClick={() => toggleFavorite(contact.id)}>
                            {favoriteIds.has(contact.id) ? "★ В избранном" : "☆ В избранное"}
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
}
