import { useCallback, useEffect, useState } from "react";

import { authApi } from "../authApi";
import {
    clearRecoveryCredential,
    effectiveRecoveryStatus,
    readRecoveryCredential,
    recoveryCredential,
    saveRecoveryCredential,
} from "../passwordRecoveryModel";
import { formatRussianPhoneInput } from "../registrationModel";
import PasswordField from "./PasswordField";

export default function PasswordRecovery({ fallbackPhone, fallbackPhoneDisplay, onClose }) {
    const [request, setRequest] = useState(readRecoveryCredential);
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [status, setStatus] = useState(() => effectiveRecoveryStatus(readRecoveryCredential()));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const updateRequest = useCallback((next) => {
        const effectiveStatus = effectiveRecoveryStatus(next);
        const stored = { ...next, status: effectiveStatus };
        setRequest(stored);
        setStatus(effectiveStatus);
        saveRecoveryCredential(stored);
    }, []);

    const checkStatus = useCallback(async (silent = false) => {
        if (!request) return;
        if (!silent) setLoading(true);
        setError("");
        try {
            const result = await authApi.recoveryStatus(recoveryCredential(request));
            updateRequest({ ...request, ...result });
        } catch (requestError) {
            if (!silent) setError(requestError.message || "Не удалось проверить заявку");
        } finally {
            if (!silent) setLoading(false);
        }
    }, [request, updateRequest]);

    useEffect(() => {
        if (!request || status !== "pending") return undefined;
        const interval = window.setInterval(() => checkStatus(true), 10_000);
        return () => window.clearInterval(interval);
    }, [checkStatus, request, status]);

    const start = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        try {
            updateRequest(await authApi.startRecovery({ phone }));
        } catch (requestError) {
            setError(requestError.message || "Не удалось создать заявку");
        } finally {
            setLoading(false);
        }
    };

    const reset = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        try {
            await authApi.resetPassword({
                ...recoveryCredential(request),
                password,
                passwordConfirmation,
            });
            clearRecoveryCredential();
            setRequest(null);
            setStatus("completed");
        } catch (requestError) {
            setError(requestError.message || "Не удалось изменить пароль");
        } finally {
            setLoading(false);
        }
    };

    const restart = () => {
        clearRecoveryCredential();
        setRequest(null);
        setStatus("start");
        setPhone("");
        setError("");
    };

    const contactPhone = request?.contactPhone ?? fallbackPhone;
    const contactPhoneDisplay = request?.contactPhoneDisplay ?? fallbackPhoneDisplay;

    return (
        <div className="auth-modal-backdrop" role="presentation" onMouseDown={onClose}>
            <section className="auth-modal auth-recovery-modal" role="dialog" aria-modal="true" aria-labelledby="recovery-title" onMouseDown={(event) => event.stopPropagation()}>
                <button className="auth-modal-close" type="button" aria-label="Закрыть" onClick={onClose}>×</button>
                <div className="auth-modal-symbol" aria-hidden="true">🔑</div>
                <h2 id="recovery-title">Восстановление пароля</h2>

                {status === "start" ? (
                    <form className="auth-recovery-form" onSubmit={start}>
                        <p>Введите номер телефона, указанный при регистрации.</p>
                        <label className="auth-field" htmlFor="recovery-phone">
                            <span>Телефон</span>
                            <input id="recovery-phone" type="tel" value={phone} onChange={(event) => setPhone(formatRussianPhoneInput(event.target.value))} placeholder="+7 (999) 123-45-67" autoComplete="tel" required />
                        </label>
                        <button className="auth-primary-button" type="submit" disabled={loading}>{loading ? "Создаём заявку…" : "Получить код заявки"}</button>
                    </form>
                ) : null}

                {status === "pending" && request ? (
                    <div className="auth-recovery-state">
                        <p>Позвоните администратору, назовите фамилию и код заявки:</p>
                        <strong className="auth-recovery-code">{request.requestCode}</strong>
                        <a className="auth-primary-button auth-call-button" href={`tel:${contactPhone}`}>Позвонить: {contactPhoneDisplay}</a>
                        <p className="auth-recovery-note">После проверки администратор разрешит смену пароля. Эта страница обновится автоматически.</p>
                        <button type="button" className="auth-secondary-button" onClick={() => checkStatus()} disabled={loading}>{loading ? "Проверяем…" : "Проверить решение"}</button>
                    </div>
                ) : null}

                {status === "approved" && request ? (
                    <form className="auth-recovery-form" onSubmit={reset}>
                        <p>Администратор подтвердил вашу личность. Задайте новый пароль.</p>
                        <PasswordField id="recovery-password" label="Новый пароль" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
                        <PasswordField id="recovery-password-confirmation" label="Повторите пароль" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} autoComplete="new-password" />
                        <button className="auth-primary-button" type="submit" disabled={loading}>{loading ? "Сохраняем…" : "Сохранить новый пароль"}</button>
                    </form>
                ) : null}

                {status === "completed" ? <div className="auth-recovery-state"><p>Пароль изменён. Все прежние сеансы закрыты.</p><button className="auth-primary-button" type="button" onClick={onClose}>Войти с новым паролем</button></div> : null}
                {["rejected", "expired", "superseded"].includes(status) ? <div className="auth-recovery-state"><p>{status === "rejected" ? "Администратор отклонил заявку." : "Срок действия заявки истёк или создана более новая заявка."}</p><button className="auth-primary-button" type="button" onClick={restart}>Создать новую заявку</button></div> : null}

                {error ? <p className="auth-error" role="alert">{error}</p> : null}
                <button className="auth-text-button" type="button" onClick={onClose}>Вернуться ко входу</button>
            </section>
        </div>
    );
}
