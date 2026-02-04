// src/components/UserList.jsx
export default function UserList({
    users,
    activeUserId,
    onSelect
}) {
    return (
        <aside className="user-list">
            {users.map(user => (
                <div
                    key={user.id}
                    className={
                        "user-item " +
                        (user.id === activeUserId ? "active" : "")
                    }
                    onClick={() => onSelect(user.id)}
                >
                    {user.name}
                </div>
            ))}
        </aside>
    );
}