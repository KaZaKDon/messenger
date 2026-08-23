import { useMemo, useState } from "react";
import {
    GROUP_CONTENT_LABELS,
    GROUP_MODE_LABELS,
    GROUP_POLICY_LABELS,
    GROUP_STATUS_LABELS,
    GROUP_VISIBILITY_LABELS,
    groupKindLabel,
} from "../groupManagementModel";

function dateTimeInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

function AssignmentEditor({ title, kind, entries, candidates, processing, onChange }) {
    const assignedIds = useMemo(
        () => new Set(entries.map((entry) => entry.user?.id).filter(Boolean)),
        [entries],
    );
    const available = candidates.filter((user) => !assignedIds.has(user.id));
    const [selectedId, setSelectedId] = useState("");

    return (
        <section className="admin-group-assignments">
            <h3>{title}</h3>
            <div className="admin-group-add-person">
                <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                    <option value="">Выберите пользователя</option>
                    {available.map((user) => (
                        <option key={user.id} value={user.id}>
                            {user.name || user.phone} · {user.role}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    disabled={!selectedId || processing}
                    onClick={() => onChange(kind, selectedId, true)}
                >
                    Добавить
                </button>
            </div>
            <div className="admin-group-person-list">
                {entries.map((entry) => (
                    <div key={entry.user?.id}>
                        <span>
                            <strong>{entry.user?.name || "Без имени"}</strong>
                            <small>{entry.user?.phone || entry.user?.role}</small>
                        </span>
                        <button
                            type="button"
                            disabled={processing || entry.user?.role === "admin"}
                            title={entry.user?.role === "admin" ? "Администратор защищён" : "Убрать"}
                            onClick={() => onChange(kind, entry.user.id, false)}
                        >
                            Убрать
                        </button>
                    </div>
                ))}
                {entries.length === 0 ? <p>Пока никто не назначен.</p> : null}
            </div>
        </section>
    );
}

export default function AdminGroupDetails({
    group,
    currentUser,
    candidates,
    processing,
    error,
    onSave,
    onStatus,
    onAssignment,
    onSetOwner,
    onClearOwner,
    onClose,
}) {
    const isAdmin = currentUser?.role === "admin";
    const [form, setForm] = useState(group);
    const [status, setStatus] = useState(group.status);
    const [reason, setReason] = useState("");
    const [ownerForm, setOwnerForm] = useState({
        userId: group.owner?.id || "",
        ownershipStartsAt: dateTimeInput(group.ownershipStartsAt) || dateTimeInput(new Date()),
        ownershipEndsAt: dateTimeInput(group.ownershipEndsAt),
    });

    const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

    return (
        <div className="admin-group-modal" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !processing) onClose();
        }}>
            <article className="admin-group-details">
                <header>
                    <div>
                        <span>{groupKindLabel(group)} · {group.chatId}</span>
                        <h2>{group.title}</h2>
                    </div>
                    <button type="button" onClick={onClose} disabled={processing} aria-label="Закрыть">×</button>
                </header>

                {group.isVip ? (
                    <p className="admin-group-note">VIP-группа скрыта от модераторов. Доступом управляет только администратор.</p>
                ) : null}
                {error ? <p className="admin-group-dialog-error" role="alert">{error}</p> : null}

                <section className="admin-group-settings">
                    <h3>Основные настройки</h3>
                    <div className="admin-group-form-grid">
                        <label className="wide">
                            Название
                            <input
                                value={form.title}
                                onChange={(event) => setField("title", event.target.value)}
                                disabled={!isAdmin || group.isVip || processing}
                            />
                        </label>
                        <label>
                            Режим
                            <select value={form.mode} onChange={(event) => setField("mode", event.target.value)} disabled={!isAdmin || group.isVip || processing}>
                                {Object.entries(GROUP_MODE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                            </select>
                        </label>
                        <label>
                            Содержимое
                            <select value={form.contentType} onChange={(event) => setField("contentType", event.target.value)} disabled={!isAdmin || group.isVip || processing}>
                                {Object.entries(GROUP_CONTENT_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                            </select>
                        </label>
                        <label>
                            Видимость
                            <select value={form.visibility} onChange={(event) => setField("visibility", event.target.value)} disabled={!isAdmin || group.isVip || processing}>
                                {Object.entries(GROUP_VISIBILITY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                            </select>
                        </label>
                        <label>
                            Кто публикует
                            <select value={form.publishPolicy} onChange={(event) => setField("publishPolicy", event.target.value)} disabled={!isAdmin || group.isVip || processing}>
                                {Object.entries(GROUP_POLICY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                            </select>
                        </label>
                        {form.contentType === "advertisement" ? (
                            <label>
                                Срок объявления, дней
                                <input
                                    type="number"
                                    min="1"
                                    max="365"
                                    value={form.advertisementLifetimeDays ?? ""}
                                    onChange={(event) => setField("advertisementLifetimeDays", event.target.value)}
                                    disabled={!isAdmin || processing}
                                />
                            </label>
                        ) : null}
                    </div>
                    {isAdmin && !group.isVip ? (
                        <button className="primary" type="button" onClick={() => onSave(form)} disabled={processing}>
                            Сохранить настройки
                        </button>
                    ) : null}
                </section>

                <section className="admin-group-status-editor">
                    <h3>Состояние группы</h3>
                    <div>
                        <select value={status} onChange={(event) => setStatus(event.target.value)} disabled={processing}>
                            {Object.entries(GROUP_STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                        </select>
                        {status !== "active" ? (
                            <input
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                placeholder="Причина отключения"
                                minLength="3"
                                maxLength="500"
                            />
                        ) : null}
                        <button type="button" onClick={() => onStatus(status, reason)} disabled={processing || status === group.status}>
                            Применить
                        </button>
                    </div>
                    <small>Удаления из базы нет: группа отключается или переносится в архив.</small>
                </section>

                {group.visibility === "private" ? (
                    <AssignmentEditor
                        title="Участники и видимость"
                        kind="members"
                        entries={group.members ?? []}
                        candidates={candidates}
                        processing={processing}
                        onChange={onAssignment}
                    />
                ) : null}

                {group.publishPolicy === "selected_authors" ? (
                    <AssignmentEditor
                        title="Назначенные авторы"
                        kind="publishers"
                        entries={group.publishers ?? []}
                        candidates={candidates}
                        processing={processing}
                        onChange={onAssignment}
                    />
                ) : null}

                {isAdmin && group.publishPolicy === "owner" ? (
                    <section className="admin-group-owner">
                        <h3>Владелец по договору</h3>
                        <div className="admin-group-form-grid">
                            <label className="wide">
                                Владелец
                                <select value={ownerForm.userId} onChange={(event) => setOwnerForm((current) => ({ ...current, userId: event.target.value }))}>
                                    <option value="">Выберите пользователя</option>
                                    {candidates.map((user) => <option key={user.id} value={user.id}>{user.name || user.phone}</option>)}
                                </select>
                            </label>
                            <label>
                                Начало владения
                                <input type="datetime-local" value={ownerForm.ownershipStartsAt} onChange={(event) => setOwnerForm((current) => ({ ...current, ownershipStartsAt: event.target.value }))} />
                            </label>
                            <label>
                                Окончание владения
                                <input type="datetime-local" value={ownerForm.ownershipEndsAt} onChange={(event) => setOwnerForm((current) => ({ ...current, ownershipEndsAt: event.target.value }))} />
                            </label>
                        </div>
                        <div className="admin-group-owner-actions">
                            <button className="primary" type="button" onClick={() => onSetOwner(ownerForm)} disabled={processing}>Сохранить владельца</button>
                            {group.owner ? <button type="button" onClick={() => onClearOwner("Договор завершён")} disabled={processing}>Снять владельца</button> : null}
                        </div>
                    </section>
                ) : null}
            </article>
        </div>
    );
}
