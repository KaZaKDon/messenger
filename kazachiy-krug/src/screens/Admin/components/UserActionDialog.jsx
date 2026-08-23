import { useState } from "react";

const ACTION_TEXT = {
    block: {
        title: "Блокировка пользователя",
        description: "Активные сессии пользователя будут закрыты.",
        confirm: "Заблокировать",
    },
    unblock: {
        title: "Разблокировка пользователя",
        description: "Пользователь снова сможет войти в мессенджер.",
        confirm: "Разблокировать",
    },
    delete: {
        title: "Мягкое удаление аккаунта",
        description: "Аккаунт будет скрыт, сессии закрыты, а объявления сняты с публикации.",
        confirm: "Удалить аккаунт",
    },
};

export default function UserActionDialog({ action, user, processing, onConfirm, onClose }) {
    const [reason, setReason] = useState("");
    const content = ACTION_TEXT[action];
    if (!content || !user) return null;
    const requiresReason = action === "block" || action === "delete";
    const canSubmit = !processing && (!requiresReason || reason.trim().length >= 3);

    return (
        <div className="admin-user-action-backdrop" role="presentation" onClick={onClose}>
            <div
                className="admin-user-action-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-user-action-title"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 id="admin-user-action-title">{content.title}</h2>
                <p><strong>{user.name}</strong> · {user.phone}</p>
                <p>{content.description}</p>

                {requiresReason ? (
                    <label>
                        Причина <span aria-hidden="true">*</span>
                        <textarea
                            autoFocus
                            rows="4"
                            maxLength="500"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder={action === "block" ? "Укажите причину блокировки" : "Укажите причину удаления"}
                        />
                        <small>{reason.trim().length}/500 · минимум 3 символа</small>
                    </label>
                ) : null}

                <div className="admin-user-action-buttons">
                    <button type="button" onClick={onClose} disabled={processing}>Отмена</button>
                    <button
                        type="button"
                        className={`confirm-${action}`}
                        onClick={() => onConfirm(reason.trim())}
                        disabled={!canSubmit}
                    >
                        {processing ? "Выполняется…" : content.confirm}
                    </button>
                </div>
            </div>
        </div>
    );
}

