import { useState } from "react";

export default function RejectRegistrationModal({ request, processing, onClose, onConfirm }) {
    const [reason, setReason] = useState("");
    const [validationError, setValidationError] = useState("");

    const handleSubmit = async (event) => {
        event.preventDefault();
        const normalizedReason = reason.trim();
        if (normalizedReason.length < 3) {
            setValidationError("Укажите причину отклонения: не менее трёх символов");
            return;
        }
        setValidationError("");
        const succeeded = await onConfirm(request, normalizedReason);
        if (succeeded) onClose();
    };

    return (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={processing ? undefined : onClose}>
            <form
                className="admin-reject-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-reject-title"
                onSubmit={handleSubmit}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <h2 id="admin-reject-title">Отклонить заявку</h2>
                <p>Пользователь: <strong>{request.name}</strong></p>
                <label htmlFor="admin-reject-reason">Причина отклонения</label>
                <textarea
                    id="admin-reject-reason"
                    value={reason}
                    onChange={(event) => { setReason(event.target.value); setValidationError(""); }}
                    maxLength="500"
                    rows="4"
                    autoFocus
                    placeholder="Например: не удалось подтвердить данные"
                    disabled={processing}
                    required
                />
                <small>{reason.length} из 500 символов</small>
                {validationError ? <p className="admin-error" role="alert">{validationError}</p> : null}
                <div className="admin-modal-actions">
                    <button type="button" disabled={processing} onClick={onClose}>Отмена</button>
                    <button className="reject" type="submit" disabled={processing}>
                        {processing ? "Отклоняем…" : "Отклонить заявку"}
                    </button>
                </div>
            </form>
        </div>
    );
}
