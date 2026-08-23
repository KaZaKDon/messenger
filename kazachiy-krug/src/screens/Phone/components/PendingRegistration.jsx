function formatExpiry(value) {
    if (!value) return "в течение трёх дней";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "в течение трёх дней";
    return `до ${new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date)}`;
}

const STATUS_MESSAGES = Object.freeze({
    active: {
        className: "success",
        title: "Аккаунт подтверждён",
        text: "Теперь можно войти в мессенджер по номеру телефона и паролю.",
    },
    rejected: {
        className: "error",
        title: "Заявка отклонена",
        text: "Свяжитесь с администратором, чтобы уточнить причину решения.",
    },
    expired: {
        className: "warning",
        title: "Срок заявки истёк",
        text: "Трёхдневный срок закончился. Подайте новую заявку на регистрацию.",
    },
});

export default function PendingRegistration({ registration, status, loading, error, onCheck, onLogin, onRegister }) {
    const decided = STATUS_MESSAGES[status] ?? null;
    const phone = registration.contactPhone || "+79381532981";
    const phoneDisplay = registration.contactPhoneDisplay || "8 (938) 153-29-81";

    return (
        <section className="auth-form auth-result">
            {decided ? (
                <>
                    <div className={`auth-result-symbol ${decided.className}`} aria-hidden="true">
                        {status === "active" ? "✓" : status === "expired" ? "⌛" : "!"}
                    </div>
                    <div className="auth-section-heading">
                        <h1>{decided.title}</h1>
                        <p>{decided.text}</p>
                    </div>
                    {error ? <p className="auth-message auth-message-error" role="alert">{error}</p> : null}
                    {status === "expired" ? (
                        <button className="auth-primary-button" type="button" onClick={onRegister}>Подать новую заявку</button>
                    ) : (
                        <button className="auth-primary-button" type="button" onClick={onLogin}>Перейти ко входу</button>
                    )}
                </>
            ) : (
                <>
                    <div className="auth-section-heading">
                        <h1>Заявка принята</h1>
                        <p>Аккаунт ожидает подтверждения администратором</p>
                    </div>

                    <div className="auth-code-card">
                        <span>Ваш код</span>
                        <strong>{registration.approvalCode || "— — — —"}</strong>
                        <small>Заявка действует {formatExpiry(registration.expiresAt)}</small>
                    </div>

                    <div className="auth-instruction">
                        <h2>Что делать дальше</h2>
                        <ol>
                            <li>Позвоните администратору с номера, указанного при регистрации.</li>
                            <li>Назовите свою фамилию и четырёхзначный код.</li>
                            <li>После подтверждения нажмите «Проверить статус».</li>
                        </ol>
                    </div>

                    <a className="auth-primary-button auth-call-button" href={`tel:${phone}`}>Позвонить: {phoneDisplay}</a>
                    <p className="auth-security-note">Администратор никогда не спрашивает пароль.</p>

                    {error ? <p className="auth-message auth-message-error" role="alert">{error}</p> : null}
                    <button className="auth-secondary-button" type="button" disabled={loading} onClick={onCheck}>
                        {loading ? "Проверяем…" : "Проверить статус"}
                    </button>
                    <button className="auth-text-button" type="button" onClick={onLogin}>Вернуться ко входу</button>
                </>
            )}
        </section>
    );
}
