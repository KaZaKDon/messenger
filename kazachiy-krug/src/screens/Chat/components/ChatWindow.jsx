export default function ChatWindow({
    chat,
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
                {chat?.messages.map((m) => (
                    <div
                        key={m.id}
                        className={`message ${m.fromMe ? "outgoing" : "incoming"}`}
                    >
                        <div className="bubble">{m.text}</div>
                    </div>
                ))}
            </div>

            <footer className="chat-input">
                <input
                    value={chat?.draft ?? ""}
                    onChange={(e) =>
                        onDraftChange?.(e.target.value)
                    }
                    placeholder="Сообщение..."
                />
                <button
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