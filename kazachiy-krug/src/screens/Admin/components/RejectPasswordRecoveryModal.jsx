import { useState } from "react";

export default function RejectPasswordRecoveryModal({ request, processing, onClose, onConfirm }) {
    const [reason, setReason] = useState("");
    const [error, setError] = useState("");

    const submit = async (event) => {
        event.preventDefault();
        const value = reason.trim();
        if (value.length < 3) return setError("Укажите причину: не менее трёх символов");
        if (await onConfirm(request, value)) onClose();
    };

    return <div className="admin-modal-backdrop" role="presentation" onMouseDown={processing ? undefined : onClose}><form className="admin-reject-modal" role="dialog" aria-modal="true" aria-labelledby="recovery-reject-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><h2 id="recovery-reject-title">Отклонить восстановление</h2><p>Пользователь: <strong>{request.user?.name}</strong></p><label htmlFor="recovery-reject-reason">Причина</label><textarea id="recovery-reject-reason" value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} maxLength="500" rows="4" autoFocus disabled={processing} required /><small>{reason.length} из 500 символов</small>{error ? <p className="admin-error" role="alert">{error}</p> : null}<div className="admin-modal-actions"><button type="button" disabled={processing} onClick={onClose}>Отмена</button><button className="reject" type="submit" disabled={processing}>{processing ? "Отклоняем…" : "Отклонить"}</button></div></form></div>;
}
