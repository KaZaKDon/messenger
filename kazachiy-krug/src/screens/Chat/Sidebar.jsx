export default function Sidebar({ chats, setMode, setActiveChatId }) {
    return (
        <aside className="chat-sidebar">
            
            <div className="sidebar-actions">
                <button onClick={() => setMode("create-chat")}>
                    + Чат
                </button>
                <button onClick={() => setMode("create-group")}>
                    + Группа
                </button>
            </div>

            <div className="chat-list">
                {chats.map(chat => (
                    <div
                        key={chat.id}
                        className="chat-item"
                        onClick={() => {
                            setActiveChatId(chat.id);
                            setMode("chat");
                        }}
                    >
                        {chat.title}
                    </div>
                ))}
            </div>

            {/* Верхняя навигация */}
            <div className="sidebar-nav">
                <button className="nav-btn active">💬</button>
                <button className="nav-btn">👥</button>
                <button className="nav-btn">📞</button>
            </div>

            {/* Список диалогов */}
            <div className="chat-list">
                <div className="chat-item active">
                    <span className="chat-title">Атаман</span>
                </div>

                <div className="chat-item">
                    <span className="chat-title">Круг</span>
                </div>
            </div>

            {/* Низ */}
            <div className="sidebar-bottom">
                <button className="nav-btn">⚙</button>
            </div>

        </aside>
    );
}