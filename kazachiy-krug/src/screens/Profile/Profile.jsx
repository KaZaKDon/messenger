import { useEffect, useMemo, useState } from "react";
import "./Profile.css";

const API_BASE = "http://localhost:3000";

const FIELD_CONFIG = {
    phone: { label: "Телефон", placeholder: "+7 900 700 00 00" },
    region: { label: "Регион", placeholder: "Ростов-на-Дону" },
    occupation: { label: "Занятие", placeholder: "Торговец" },
};

const DEFAULT_DETAILS = {
    phone: "+7 900 700 00 00",
    region: "Ростов-на-Дону",
    occupation: "Торговец",
};

export default function Profile({ currentUser }) {
    const userName = currentUser?.name ?? "Казак61";
    const fullName = useMemo(() => {
        if (!currentUser?.name) return "Дима Кузнецов";
        return currentUser.name;
    }, [currentUser?.name]);

    const [details, setDetails] = useState(DEFAULT_DETAILS);
    const [editingField, setEditingField] = useState(null);
    const [draftValue, setDraftValue] = useState("");

    useEffect(() => {
        let active = true;

        async function loadProfile() {
            const userId = currentUser?.id;
            if (!userId) return;

            try {
                const response = await fetch(`${API_BASE}/me?userId=${encodeURIComponent(userId)}`);

                if (!response.ok) {
                    throw new Error(`Failed to load profile (${response.status})`);
                }

                const profile = await response.json();

                if (!active) return;

                setDetails({
                    phone: profile.phone ?? DEFAULT_DETAILS.phone,
                    region: profile.region ?? DEFAULT_DETAILS.region,
                    occupation: profile.occupation ?? DEFAULT_DETAILS.occupation,
                });
            } catch (error) {
                console.error("Failed to load profile:", error);
            }
        }

        loadProfile();

        return () => {
            active = false;
        };
    }, [currentUser?.id]);

    const openEditor = (field) => {
        setEditingField(field);
        setDraftValue(details[field]);
    };

    const saveEditor = async () => {
        if (!editingField) return;

        const nextValue = draftValue.trim();
        if (!nextValue) return;
        if (!currentUser?.id) return;

        const previousDetails = details;
        const nextDetails = {
            ...details,
            [editingField]: nextValue,
        };

        setDetails(nextDetails);

        try {
            const response = await fetch(`${API_BASE}/me`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    userId: currentUser.id,
                    [editingField]: nextValue,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to save profile (${response.status})`);
            }

            const profile = await response.json();

            setDetails({
                phone: profile.phone ?? nextDetails.phone,
                region: profile.region ?? nextDetails.region,
                occupation: profile.occupation ?? nextDetails.occupation,
            });
        } catch (error) {
            console.error("Failed to save profile:", error);
            setDetails(previousDetails);
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
