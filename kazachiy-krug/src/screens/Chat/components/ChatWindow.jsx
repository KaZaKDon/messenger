export default function ChatWindow({
    chat,
    currentUserId,
    onSend,
    onDraftChange
}) {
    return (
        <section className="chat-window">
            <header className="chat-header">
                <div>
                    <h2>{chat?.user?.name}</h2>
                    <span className="chat-type">личный чат</span>
                </div>
            </header>

            <div className="chat-messages">
                <div className="messages">
                    {chat?.messages.map((m) => {
                        const hasSender = Boolean(m.senderId);
                        const isMe = hasSender
                            ? m.senderId === currentUserId
                            : m.fromMe === true;

                        return (
                            <div
                                key={m.id}
                                className={`message ${isMe ? "outgoing" : "incoming"}`}
                            >
                                <div className="bubble">{m.text}</div>
                                {isMe && m.status && (
                                    <div className={`message-status ${m.status}`}>
                                        {m.status === "sent" && "✓"}
                                        {(m.status === "delivered" || m.status === "read") && "✓✓"}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <footer className="chat-input">
                <input
                    value={chat?.draft ?? ""}
                    disabled={!chat}
                    onChange={(e) =>
                        onDraftChange?.(e.target.value)
                    }
                    placeholder="Сообщение..."
                />
                <button
                    disabled={!chat}
                    onClick={() => {
                        if (!chat?.draft?.trim()) return;
                        onSend(chat.draft);
                        onDraftChange("");
                    }}
                >
                    ➤
                </button>
            </footer>
        </section>
    );
}