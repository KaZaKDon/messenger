import { formatAdminDate } from "../userManagementModel";

function Detail({ label, children }) {
    return <div className="admin-registration-detail"><span>{label}</span><div>{children || "Не указано"}</div></div>;
}

export default function PasswordRecoveryCard({ request, processing, onApprove, onReject }) {
    const profile = request.user?.privateProfile ?? {};
    const fullName = [profile.lastName, profile.firstName].filter(Boolean).join(" ") || request.user?.name || "—";
    const approved = request.status === "approved";

    return (
        <article className="admin-registration-card">
            <header className="admin-registration-card-header">
                <div>
                    <h2>{request.user?.name || "Пользователь"}</h2>
                    <p>{fullName}</p>
                </div>
                <div className="admin-registration-code">
                    <span>Код заявки</span>
                    <strong>{request.requestCode}</strong>
                </div>
            </header>
            <div className="admin-registration-details">
                <Detail label="Телефон"><a href={`tel:${request.user?.phone}`}>{request.user?.phone}</a></Detail>
                <Detail label="Статус аккаунта">{request.user?.status}</Detail>
                <Detail label="Населённый пункт">{profile.settlement}</Detail>
                <Detail label="Занятие">{profile.occupation}</Detail>
                <Detail label="Создана">{formatAdminDate(request.createdAt)}</Detail>
                <Detail label="Истекает">{formatAdminDate(request.expiresAt)}</Detail>
            </div>
            {approved ? <p className="admin-recovery-approved">Смена пароля разрешена. Ожидаем, когда пользователь задаст новый пароль.</p> : (
                <div className="admin-registration-actions">
                    <button className="approve" type="button" disabled={processing} onClick={() => onApprove(request)}>{processing ? "Обрабатываем…" : "Разрешить смену пароля"}</button>
                    <button className="reject" type="button" disabled={processing} onClick={() => onReject(request)}>Отклонить</button>
                </div>
            )}
        </article>
    );
}
