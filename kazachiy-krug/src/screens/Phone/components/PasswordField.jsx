import { useState } from "react";

function EyeIcon({ crossed }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
            <circle cx="12" cy="12" r="2.7" />
            {crossed ? <path d="m4 4 16 16" /> : null}
        </svg>
    );
}

export default function PasswordField({
    id,
    label,
    value,
    onChange,
    autoComplete,
    placeholder = "Не менее 8 символов",
}) {
    const [visible, setVisible] = useState(false);

    return (
        <label className="auth-field" htmlFor={id}>
            <span>{label}</span>
            <span className="auth-password-field">
                <input
                    id={id}
                    type={visible ? "text" : "password"}
                    value={value}
                    onChange={onChange}
                    autoComplete={autoComplete}
                    placeholder={placeholder}
                    minLength="8"
                    maxLength="128"
                    required
                />
                <button
                    type="button"
                    aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
                    aria-pressed={visible}
                    onClick={() => setVisible((current) => !current)}
                >
                    <EyeIcon crossed={visible} />
                </button>
            </span>
        </label>
    );
}
