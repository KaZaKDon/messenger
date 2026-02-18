// src/components/UserList.jsx
import { useMemo, useState } from "react";

export default function UserList({
    users,
    activeUserId,
    onSelect
}) {
    const [query, setQuery] = useState("");

    const filteredUsers = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) return users;

        return users.filter((user) =>
            user.name.toLowerCase().includes(normalizedQuery)
        );
    }, [query, users]);


    return (
        <aside className="user-list">
            <div className="user-list-search">
                <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Поиск"
                />
                <button type="button">Поиск</button>
            </div>

            {filteredUsers.map(user => (
                <div
                    key={user.id}
                    className={
                        "user-item " +
                        (user.id === activeUserId ? "active" : "")
                    }
                    onClick={() => onSelect(user.id)}
                >
                    <span
                        className={
                            "user-status " + (user.isOnline ? "online" : "offline")
                        }
                    />
                    <span className="user-name">{user.name}</span>
                </div>
            ))}

            {filteredUsers.length === 0 ? (
                <div className="user-list-empty">Ничего не найдено</div>
            ) : null}

        </aside>
    );
}