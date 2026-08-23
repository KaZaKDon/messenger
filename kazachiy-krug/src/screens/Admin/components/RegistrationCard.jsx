import { formatRegistrationDate } from "../registrationLabels";
import { buildRegistrationView } from "../registrationViewModel";

function Detail({ label, children, wide = false }) {
    return (
        <div className={`admin-registration-detail ${wide ? "wide" : ""}`}>
            <span>{label}</span>
            <div>{children || "Не указано"}</div>
        </div>
    );
}

export default function RegistrationCard({ request, processing, onApprove, onReject }) {
    const view = buildRegistrationView(request);
    const { application } = view;

    return (
        <article className="admin-registration-card">
            <header className="admin-registration-card-header">
                <div>
                    <h2>{request.name}</h2>
                    <p>{view.fullName}</p>
                </div>
                <div className="admin-registration-code">
                    <span>Код заявки</span>
                    <strong>{view.approvalCode}</strong>
                </div>
            </header>

            <div className="admin-registration-details">
                <Detail label="Телефон">
                    <a href={`tel:${request.phone}`}>{request.phone}</a>
                </Detail>
                <Detail label="Email">{request.email}</Detail>
                <Detail label="Населённый пункт">{application.settlement}</Detail>
                <Detail label="Род занятий">{application.occupation}</Detail>
                <Detail label="Создана">{formatRegistrationDate(request.createdAt)}</Detail>
                <Detail label="Истекает">{formatRegistrationDate(application.expiresAt)}</Detail>
                <Detail label="Цели вступления" wide>
                    {view.purposes.length ? (
                        <div className="admin-purpose-list">
                            {view.purposes.map((purpose) => <span key={purpose}>{purpose}</span>)}
                        </div>
                    ) : null}
                </Detail>
                {application.purposeNote ? <Detail label="Пояснение" wide>{application.purposeNote}</Detail> : null}
                <Detail label="Обязательные согласия" wide>
                    {view.acceptanceText}
                </Detail>
            </div>

            <div className="admin-registration-actions">
                <button className="approve" type="button" disabled={processing} onClick={() => onApprove(request)}>
                    {processing ? "Обрабатываем…" : "Подтвердить"}
                </button>
                <button className="reject" type="button" disabled={processing} onClick={() => onReject(request)}>
                    Отклонить
                </button>
            </div>
        </article>
    );
}
