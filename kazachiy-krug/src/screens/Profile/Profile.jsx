import { useMemo, useState } from "react";
import "./Profile.css";

const STORAGE_KEY = "profileDetails";

const FIELD_CONFIG = {
    phone: { label: "Телефон", placeholder: "+7 900 700 00 00" },
    region: { label: "Регион", placeholder: "Ростов-на-Дону" },
    occupation: { label: "Занятие", placeholder: "Торговец" },
};

function getInitialDetails() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;

        return {
            phone: parsed?.phone ?? "+7 900 700 00 00",
            region: parsed?.region ?? "Ростов-на-Дону",
            occupation: parsed?.occupation ?? "Торговец",
        };
    } catch {
        return {
            phone: "+7 900 700 00 00",
            region: "Ростов-на-Дону",
            occupation: "Торговец",
        };
    }
}

export default function Profile({ currentUser }) {
    const userName = currentUser?.name ?? "Казак61";
    const fullName = useMemo(() => {
        if (!currentUser?.name) return "Дима Кузнецов";
        return currentUser.name;
    }, [currentUser?.name]);

    const [details, setDetails] = useState(getInitialDetails);
    const [editingField, setEditingField] = useState(null);
    const [draftValue, setDraftValue] = useState("");

    const openEditor = (field) => {
        setEditingField(field);
        setDraftValue(details[field]);
    };

    const saveEditor = () => {
        if (!editingField) return;

        const nextValue = draftValue.trim();
        if (!nextValue) return;

        const nextDetails = {
            ...details,
            [editingField]: nextValue,
        };

        setDetails(nextDetails);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDetails));
        } catch {
            // ignore storage errors
        }

        setEditingField(null);
        setDraftValue("");
    };


    return (
        <section className="profile-page">
            <header className="profile-page-header">
                <h1>Профиль</h1>
            </header>

            <div className="profile-card">
                <div className="profile-top">
                    <div className="profile-avatar">{userName.slice(0, 1).toUpperCase()}</div>
                    <div className="profile-main-info">
                        <h2>{userName}</h2>
                        <p>{fullName}</p>
                        <span className="online">онлайн ●</span>
                    </div>
                </div>

                <div className="profile-detail-list">
                    {Object.entries(FIELD_CONFIG).map(([field, config]) => (
                        <div className="profile-detail-row" key={field}>
                            <span className="profile-detail-label">{config.label}</span>

                            {editingField === field ? (
                                <input
                                    value={draftValue}
                                    onChange={(event) => setDraftValue(event.target.value)}
                                    placeholder={config.placeholder}
                                    className="profile-input"
                                />
                            ) : (
                                <strong>{details[field]}</strong>
                            )}

                            {editingField === field ? (
                                <button
                                    type="button"
                                    className="profile-edit-btn"
                                    onClick={saveEditor}
                                >
                                    Сохранить
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="profile-edit-btn"
                                    onClick={() => openEditor(field)}
                                >
                                    Изменить
                                </button>
                            )}
                        </div>
                    ))}

                </div>
            </div>
        </section>
    );
}
