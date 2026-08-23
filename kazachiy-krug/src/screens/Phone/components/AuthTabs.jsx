export default function AuthTabs({ mode, onChange }) {
    return (
        <div className="auth-tabs" role="tablist" aria-label="Авторизация">
            <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={mode === "login" ? "active" : ""}
                onClick={() => onChange("login")}
            >
                Вход
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                className={mode === "register" ? "active" : ""}
                onClick={() => onChange("register")}
            >
                Регистрация
            </button>
        </div>
    );
}
