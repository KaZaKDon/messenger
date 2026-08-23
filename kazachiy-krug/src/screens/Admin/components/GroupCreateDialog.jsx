import { useState } from "react";
import { GROUP_TEMPLATES } from "../groupManagementModel";

export default function GroupCreateDialog({ processing, error, onCreate, onClose }) {
    const [title, setTitle] = useState("");
    const [template, setTemplate] = useState("advertisement");

    const submit = (event) => {
        event.preventDefault();
        onCreate({ title, template });
    };

    return (
        <div className="admin-group-modal" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !processing) onClose();
        }}>
            <form className="admin-group-dialog" onSubmit={submit}>
                <header>
                    <div>
                        <span>Новая группа</span>
                        <h2>Добавить группу</h2>
                    </div>
                    <button type="button" onClick={onClose} disabled={processing} aria-label="Закрыть">×</button>
                </header>
                <label>
                    Название
                    <input
                        autoFocus
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        minLength="2"
                        maxLength="80"
                        required
                    />
                </label>
                <label>
                    Готовый тип правил
                    <select value={template} onChange={(event) => setTemplate(event.target.value)}>
                        {GROUP_TEMPLATES.map((item) => (
                            <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                    </select>
                </label>
                <p>Название и правила можно будет изменить. Группа создаётся активной.</p>
                {error ? <p className="admin-group-dialog-error" role="alert">{error}</p> : null}
                <footer>
                    <button type="button" onClick={onClose} disabled={processing}>Отмена</button>
                    <button className="primary" type="submit" disabled={processing}>
                        {processing ? "Создаём…" : "Создать группу"}
                    </button>
                </footer>
            </form>
        </div>
    );
}
