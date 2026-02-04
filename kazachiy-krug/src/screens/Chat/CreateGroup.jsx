import { useState } from "react";

export default function CreateGroup({ setChats, setMode, setActiveChatId }) {
    const [title, setTitle] = useState("");

    const handleCreate = () => {
        if (!title.trim()) return;

        const newGroup = {
            id: Date.now().toString(),
            title,
            type: "group",
            members: [],
            messages: []
        };

        setChats(prev => [...prev, newGroup]);
        setActiveChatId(newGroup.id);
        setMode("chat");
    };

    return (
        <div className="create-group">
            <h2>Новая группа</h2>

            <input
                type="text"
                placeholder="Название группы"
                value={title}
                onChange={e => setTitle(e.target.value)}
            />

            <div className="group-actions">
                <button onClick={handleCreate}>
                    Создать группу
                </button>

                <button
                    className="secondary"
                    onClick={() => setMode("empty")}
                >
                    Отмена
                </button>
            </div>
        </div>
    );
}