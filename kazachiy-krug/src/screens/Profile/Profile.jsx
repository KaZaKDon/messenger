import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../../shared/config";
import { PROFILE_FIELDS, profileDetails } from "./profileFields";
import "./Profile.css";

const DEFAULT_DETAILS = profileDetails();

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export default function Profile({ currentUser, setCurrentUser }) {
    const userName = currentUser?.login ?? currentUser?.name ?? "Казак61";
    const fullName = useMemo(() => {
        if (!currentUser?.name) return "Дима Кузнецов";
        return currentUser.name;
    }, [currentUser?.name]);

    const [details, setDetails] = useState(DEFAULT_DETAILS);
    const [editingField, setEditingField] = useState(null);
    const [draftValue, setDraftValue] = useState("");
    const [avatar, setAvatar] = useState(currentUser?.avatar ?? null);
    const [avatarBusy, setAvatarBusy] = useState(false);
    const [avatarError, setAvatarError] = useState("");

    const authHeaders = () => ({ Authorization: `Bearer ${sessionStorage.getItem("accessToken") || ""}` });

    useEffect(() => {
        let active = true;

        async function loadProfile() {
            const userId = currentUser?.id;
            if (!userId) return;

            try {
                const response = await fetch(`${API_BASE_URL}/me`, { headers: authHeaders() });

                if (!response.ok) {
                    throw new Error(`Failed to load profile (${response.status})`);
                }

                const profile = await response.json();

                if (!active) return;

                setDetails(profileDetails(profile));
                setAvatar(profile.avatar ?? null);
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
            const response = await fetch(`${API_BASE_URL}/me`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeaders(),
                },
                body: JSON.stringify({
                    [editingField]: nextValue,
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to save profile (${response.status})`);
            }

            const profile = await response.json();

            setDetails(profileDetails(profile));
        } catch (error) {
            console.error("Failed to save profile:", error);
            setDetails(previousDetails);
        }

        setEditingField(null);
        setDraftValue("");
    };

    const updateStoredAvatar = (nextAvatar) => {
        setAvatar(nextAvatar);
        setCurrentUser?.((user) => user ? { ...user, avatar: nextAvatar } : user);
    };

    const uploadAvatar = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!AVATAR_TYPES.has(file.type)) return setAvatarError("Разрешены только JPG, PNG и WebP");
        if (file.size > MAX_AVATAR_SIZE) return setAvatarError("Размер изображения не должен превышать 5 МБ");

        setAvatarBusy(true);
        setAvatarError("");
        try {
            const form = new FormData();
            form.append("avatar", file);
            const response = await fetch(`${API_BASE_URL}/me/avatar`, {
                method: "POST",
                headers: authHeaders(),
                body: form,
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || "Не удалось загрузить аватар");
            updateStoredAvatar(payload.user?.avatar ?? null);
        } catch (error) {
            setAvatarError(error.message);
        } finally {
            setAvatarBusy(false);
        }
    };

    const deleteAvatar = async () => {
        if (!avatar || !window.confirm("Удалить фотографию профиля?")) return;
        setAvatarBusy(true);
        setAvatarError("");
        try {
            const response = await fetch(`${API_BASE_URL}/me/avatar`, {
                method: "DELETE",
                headers: authHeaders(),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || "Не удалось удалить аватар");
            updateStoredAvatar(null);
        } catch (error) {
            setAvatarError(error.message);
        } finally {
            setAvatarBusy(false);
        }
    };


    return (
        <section className="profile-page">
            <header className="profile-page-header">
                <h1>Профиль</h1>
            </header>

            <div className="profile-card">
                <div className="profile-top">
                    <div className="profile-avatar">
                        {avatar
                            ? <img src={avatar} alt="Аватар" />
                            : userName.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="profile-avatar-controls">
                        <label className="profile-avatar-button">
                            {avatarBusy ? "Загрузка..." : (avatar ? "Заменить фото" : "Добавить фото")}
                            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={avatarBusy} />
                        </label>
                        {avatar ? <button type="button" onClick={deleteAvatar} disabled={avatarBusy}>Удалить</button> : null}
                        <small>JPG, PNG или WebP, не более 5 МБ</small>
                        {avatarError ? <span className="profile-avatar-error">{avatarError}</span> : null}
                    </div>
                    <div className="profile-main-info">
                        <h2>{userName}</h2>
                        <p>{fullName}</p>
                        <small className="profile-phone">{details.phone}</small>
                        <span className="online">онлайн ●</span>
                    </div>
                </div>

                <div className="profile-detail-list">
                    {Object.entries(PROFILE_FIELDS).map(([field, config]) => (
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
