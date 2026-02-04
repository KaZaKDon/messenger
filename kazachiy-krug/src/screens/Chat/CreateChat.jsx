import { useState } from "react";

export default function CreateChat({ title, onCreate, onCancel }) {
    const [name, setName] = useState("");

    return (
        <div className="create-chat">

            <h2>{title}</h2>

            <input
                type="text"
                placeholder="Название"
                value={name}
                onChange={(e) => setName(e.target.value)}
            />

            <div className="actions">
                <button
                    onClick={() => name.trim() && onCreate(name)}
                >
                    Создать
                </button>

                <button onClick={onCancel}>
                    Отмена
                </button>
            </div>

        </div>
    );
}