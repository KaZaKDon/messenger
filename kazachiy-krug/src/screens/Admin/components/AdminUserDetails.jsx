import {
    formatAdminDate,
    getAllowedUserActions,
    USER_ROLE_LABELS,
    USER_STATUS_LABELS,
} from "../userManagementModel";
import { purposeLabel } from "../registrationLabels";

const ACTION_LABELS = {
    block: "Заблокировать",
    unblock: "Разблокировать",
    delete: "Удалить аккаунт",
};

export default function AdminUserDetails({
    user,
    viewerRole,
    viewerId,
    onAction,
    onClose,
}) {
    if (!user) return null;
    const actions = getAllowedUserActions({ viewerRole, viewerId, user });
    const privateProfile = user.privateProfile ?? {};
    const fullName = [privateProfile.lastName, privateProfile.firstName].filter(Boolean).join(" ") || "—";
    const purposes = Array.isArray(privateProfile.purposes)
        ? privateProfile.purposes.map(purposeLabel).join(", ")
        : "";

    return (
        <div className="admin-user-drawer-backdrop" role="presentation" onClick={onClose}>
            <aside
                className="admin-user-drawer"
                role="dialog"
                aria-modal="true"
                aria-label={`Пользователь ${user.name}`}
                onClick={(event) => event.stopPropagation()}
            >
                <header>
                    <div className="admin-user-avatar large">
                        {user.avatar
                            ? <img src={user.avatar} alt="" />
                            : (user.name || "П").slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                        <h2>{user.name || "Без имени"}</h2>
                        <span className={`admin-user-status status-${user.status}`}>
                            {USER_STATUS_LABELS[user.status] ?? user.status}
                        </span>
                    </div>
                    <button type="button" className="admin-user-drawer-close" onClick={onClose} aria-label="Закрыть">
                        ✕
                    </button>
                </header>

                <dl className="admin-user-details-list">
                    <div><dt>Телефон</dt><dd><a href={`tel:${user.phone}`}>{user.phone || "—"}</a></dd></div>
                    <div><dt>Имя и фамилия</dt><dd>{fullName}</dd></div>
                    <div><dt>Населённый пункт</dt><dd>{privateProfile.settlement || "—"}</dd></div>
                    <div><dt>Занятие</dt><dd>{privateProfile.occupation || "—"}</dd></div>
                    <div className="wide"><dt>Цель регистрации</dt><dd>{purposes || "—"}</dd></div>
                    {privateProfile.purposeNote ? <div className="wide"><dt>Пояснение к цели</dt><dd>{privateProfile.purposeNote}</dd></div> : null}
                    {viewerRole === "admin" ? <div><dt>Email</dt><dd>{user.email || "—"}</dd></div> : null}
                    {viewerRole === "admin" ? <div><dt>Логин</dt><dd>{user.login || "—"}</dd></div> : null}
                    <div><dt>Роль</dt><dd>{USER_ROLE_LABELS[user.role] ?? user.role}</dd></div>
                    {viewerRole === "admin" ? <div><dt>Создан</dt><dd>{formatAdminDate(user.createdAt)}</dd></div> : null}
                    {user.blockedAt ? <div><dt>Заблокирован</dt><dd>{formatAdminDate(user.blockedAt)}</dd></div> : null}
                    {user.blockReason ? <div className="wide"><dt>Причина блокировки</dt><dd>{user.blockReason}</dd></div> : null}
                    {user.deletedAt ? <div><dt>Удалён</dt><dd>{formatAdminDate(user.deletedAt)}</dd></div> : null}
                    {user.deletionReason ? <div className="wide"><dt>Причина удаления</dt><dd>{user.deletionReason}</dd></div> : null}
                </dl>

                {actions.length > 0 ? (
                    <div className="admin-user-drawer-actions">
                        {actions.map((action) => (
                            <button
                                key={action}
                                type="button"
                                className={`action-${action}`}
                                onClick={() => onAction(action, user)}
                            >
                                {ACTION_LABELS[action]}
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="admin-user-protected-note">
                        Для этого аккаунта действия вашей роли недоступны.
                    </p>
                )}
            </aside>
        </div>
    );
}
