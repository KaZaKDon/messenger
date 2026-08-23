import { useState } from "react";

import PasswordField from "./PasswordField";

export default function LoginForm({ loading, error, onSubmit, onForgotPassword }) {
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = (event) => {
        event.preventDefault();
        onSubmit({ identifier, password });
    };

    return (
        <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-section-heading">
                <h1>Войти в мессенджер</h1>
                <p>Используйте данные, указанные при регистрации</p>
            </div>

            <div className="auth-fields auth-fields-single">
                <label className="auth-field" htmlFor="login-identifier">
                    <span>Телефон, email или логин</span>
                    <input
                        id="login-identifier"
                        value={identifier}
                        onChange={(event) => setIdentifier(event.target.value)}
                        autoComplete="username"
                        placeholder="+7 (999) 123-45-67"
                        required
                    />
                </label>
                <PasswordField
                    id="login-password"
                    label="Пароль"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                />
            </div>

            {error ? <p className="auth-message auth-message-error" role="alert">{error}</p> : null}

            <button className="auth-primary-button" type="submit" disabled={loading}>
                {loading ? "Входим…" : "Войти"}
            </button>
            <button className="auth-text-button" type="button" onClick={onForgotPassword}>
                Забыли пароль?
            </button>
        </form>
    );
}
