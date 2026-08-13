import "./Phone.css";
import "../../styles/variables.css";
import img from "./icon.jpg";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { ADMIN_PHONE, API_BASE_URL } from "../../shared/config";
import { connectSocket } from "../../shared/socket";

const EMPTY_FORM = { login: "", password: "", phone: "", name: "" };
const PENDING_KEY = "pendingRegistration";

function readPendingRegistration() {
    try {
        return JSON.parse(sessionStorage.getItem(PENDING_KEY)) ?? null;
    } catch {
        sessionStorage.removeItem(PENDING_KEY);
        return null;
    }
}

export default function Phone({ setCurrentUser }) {
    const navigate = useNavigate();
    const [pendingRegistration, setPendingRegistration] = useState(readPendingRegistration);
    const [mode, setMode] = useState(() => pendingRegistration ? "pending" : "login");
    const [form, setForm] = useState(EMPTY_FORM);
    const [showPassword, setShowPassword] = useState(false);
    const [requestCode, setRequestCode] = useState(() => pendingRegistration?.approvalCode ?? "");
    const [pendingStatus, setPendingStatus] = useState("pending");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const isRegistration = mode === "register";
    const isRecovery = mode === "recovery";

    const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
    const selectMode = (nextMode) => {
        setMode(nextMode);
        setError("");
        setRequestCode("");
    };

    const rememberPending = (phone, approvalCode) => {
        const pending = { phone, approvalCode };
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        setPendingRegistration(pending);
        setRequestCode(approvalCode);
        setPendingStatus("pending");
        setMode("pending");
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            const endpoint = isRecovery ? "recovery" : mode;
            const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const payload = await response.json();

            if (isRecovery && response.ok) {
                setRequestCode(payload.requestCode);
                return;
            }
            if (response.status === 403 && payload.status === "pending") {
                rememberPending(payload.phone, payload.approvalCode);
                return;
            }
            if (!response.ok) throw new Error(payload.error || "Не удалось выполнить запрос");

            if (isRegistration) {
                rememberPending(form.phone, payload.approvalCode);
                return;
            }

            sessionStorage.setItem("accessToken", payload.accessToken);
            sessionStorage.setItem("currentUser", JSON.stringify(payload.user));
            setCurrentUser(payload.user);
            connectSocket().emit("auth:session", { token: payload.accessToken });
            navigate("/chat");
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    };

    const checkRegistrationStatus = async () => {
        if (!pendingRegistration) return;
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`${API_BASE_URL}/auth/registration-status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pendingRegistration),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Не удалось проверить заявку");
            setPendingStatus(payload.status);
            if (payload.status === "active" || payload.status === "rejected") {
                sessionStorage.removeItem(PENDING_KEY);
                setPendingRegistration(null);
            }
        } catch (statusError) {
            setError(statusError.message);
        } finally {
            setLoading(false);
        }
    };

    if (mode === "pending" || (isRecovery && requestCode)) {
        const recovery = isRecovery;
        return (
            <section className="auth-card">
                <div className="first auth-form auth-result">
                    <img className="auth-logo" src={img} alt="Казачий круг" />
                    <h1 className="auth-title">{recovery ? "Восстановление пароля" : "Регистрация принята"}</h1>
                    <p>{recovery ? "Для восстановления доступа" : "Для подтверждения аккаунта"} позвоните администратору:</p>
                    <a className="auth-phone" href={`tel:${ADMIN_PHONE.replace(/\D/g, "")}`}>{ADMIN_PHONE}</a>
                    <p>Сообщите номер телефона и код:</p>
                    <strong className="auth-code">{requestCode}</strong>
                    <p className="auth-warning">Администратор никогда не спрашивает ваш пароль.</p>
                    {!recovery && pendingStatus === "active" && <p className="auth-success">Аккаунт подтверждён. Теперь можно войти.</p>}
                    {!recovery && pendingStatus === "rejected" && <p className="auth-error">Заявка отклонена. Свяжитесь с администратором.</p>}
                    {!recovery && pendingStatus === "pending" && <button className="auth-button" type="button" disabled={loading} onClick={checkRegistrationStatus}>{loading ? "Проверяем…" : "Проверить статус"}</button>}
                    {error && <p className="auth-error" role="alert">{error}</p>}
                    <button className="auth-button secondary" type="button" onClick={() => selectMode("login")}>Вернуться ко входу</button>
                </div>
            </section>
        );
    }

    return (
        <section className="auth-card">
            <form className="first auth-form" onSubmit={handleSubmit}>
                <img className="auth-logo" src={img} alt="Казачий круг" />
                <div className="auth-tabs" role="tablist">
                    <button type="button" className={mode === "login" ? "active" : ""} onClick={() => selectMode("login")}>Вход</button>
                    <button type="button" className={isRegistration ? "active" : ""} onClick={() => selectMode("register")}>Регистрация</button>
                </div>
                <h1 className="auth-title">{isRecovery ? "Восстановление пароля" : isRegistration ? "Создать аккаунт" : "Войти"}</h1>

                <div className="auth-fields">
                    <label>Логин
                        <input autoComplete="username" value={form.login} onChange={update("login")} placeholder="Abcd" required />
                    </label>
                    {!isRecovery && <label>Пароль
                        <span className="password-field">
                            <input type={showPassword ? "text" : "password"} autoComplete={isRegistration ? "new-password" : "current-password"} value={form.password} onChange={update("password")} placeholder="Не менее 8 символов" minLength="8" required />
                            <button type="button" aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "🙈" : "👁"}</button>
                        </span>
                    </label>}
                    {(isRegistration || isRecovery) && <label>Номер телефона
                        <input type="tel" autoComplete="tel" value={form.phone} onChange={update("phone")} placeholder="+7 951 000 00 00" required />
                    </label>}
                    {isRegistration && <label>Ник
                        <input autoComplete="nickname" value={form.name} onChange={update("name")} placeholder="Иван" required />
                    </label>}
                </div>

                {error && <p className="auth-error" role="alert">{error}</p>}
                <button className="auth-button" disabled={loading}>{loading ? "Подождите…" : isRecovery ? "Получить код" : isRegistration ? "Зарегистрироваться" : "Войти"}</button>
                {mode === "login" && <button className="auth-link" type="button" onClick={() => selectMode("recovery")}>Забыли пароль?</button>}
                {isRecovery && <button className="auth-link" type="button" onClick={() => selectMode("login")}>Вернуться ко входу</button>}
            </form>
        </section>
    );
}