export default function ThemeToggle({ isNightMode, onChange }) {
    return (
        <button
            type="button"
            className="auth-theme-toggle"
            aria-label={isNightMode ? "Включить светлую тему" : "Включить тёмную тему"}
            aria-pressed={isNightMode}
            onClick={() => onChange(!isNightMode)}
        >
            <span aria-hidden="true">{isNightMode ? "☀" : "☾"}</span>
            <span>{isNightMode ? "Светлая" : "Тёмная"}</span>
        </button>
    );
}
