export default function ChatMessages({ messages }) {
    return (
        <div className="chat-messages">
            {messages.map(msg => (
                <div
                    key={msg.id}
                    className={`message ${msg.author === "me" ? "outgoing" : "incoming"}`}
                >
                    <div className="bubble">
                        {msg.text}
                    </div>
                </div>
            ))}
        </div>
    );
}