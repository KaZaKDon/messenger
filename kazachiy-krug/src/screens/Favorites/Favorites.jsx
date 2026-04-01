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

export default function Favorites() {
    const { contacts, loading } = useContacts();
    const favoriteIds = useMemo(() => new Set(readFavorites()), []);

    const favoriteContacts = contacts.filter((contact) => favoriteIds.has(contact.id));

    return (
        <section className="settings-page">
            <header className="settings-header">
                <h1>Избранное</h1>
            </header>
            <div className="settings-panel">
                {loading ? <p>Загружаем избранные контакты...</p> : null}
                {!loading && favoriteContacts.length === 0 ? <p>Избранных контактов пока нет.</p> : null}
                {favoriteContacts.map((contact) => (
                    <div key={contact.id} className="settings-list-item">
                        <span>{contact.name}</span>
                        <span>⭐</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
