import { useRef } from "react";

export default function MessageInput({
    chat,
    onSend,
    onDraftChange,
    onTyping,
    onStopTyping
}) {
    const text = chat.draft || "";

    const typingRef = useRef(false);
    const stopTypingTimeout = useRef(null);

    const handleChange = (e) => {
        const value = e.target.value;
        onDraftChange(value);

        // пользователь начал печатать (ОДИН РАЗ)
        if (!typingRef.current && value.trim()) {
            typingRef.current = true;
            onTyping();
        }

        // сбрасываем предыдущий таймер
        clearTimeout(stopTypingTimeout.current);

        // пользователь перестал печатать через 1.2 сек
        stopTypingTimeout.current = setTimeout(() => {
            typingRef.current = false;
            onStopTyping();
        }, 1200);
    };

    const handleSend = () => {
        if (!text.trim()) return;

        onSend(text);
        onDraftChange("");

        clearTimeout(stopTypingTimeout.current);
        typingRef.current = false;
        onStopTyping();
    };

    return (
        <footer className="chat-input">
            <input
                value={text}
                onChange={handleChange}
                placeholder="Сообщение..."
            />
            <button onClick={handleSend}>➤</button>
        </footer>
    );
}