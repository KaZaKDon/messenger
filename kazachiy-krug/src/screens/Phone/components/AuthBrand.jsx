import logoDark from "../../../assets/branding/kazachiy-krug-kvk-simplified-dark.png";
import logoLight from "../../../assets/branding/kazachiy-krug-kvk-detailed.png";

export default function AuthBrand({ isNightMode }) {
    return (
        <header className="auth-brand">
            <img
                className="auth-brand-logo"
                src={isNightMode ? logoDark : logoLight}
                alt="Эмблема мессенджера «Казачий круг»"
            />
            <div className="auth-brand-name">КАЗАЧИЙ КРУГ</div>
            <p>Закрытое сообщество, общение и объявления</p>
        </header>
    );
}
