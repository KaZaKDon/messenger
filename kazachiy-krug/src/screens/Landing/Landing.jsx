import { Link } from "react-router-dom";
import eagleLogo from "../../assets/branding/kazachiy-krug-eagle-v-detailed.png";
import { landingBranding, landingHero, landingSections } from "./landingContent";
import "./Landing.css";

export default function Landing() {
    return (
        <main className="landing-page">
            <section className="landing-hero" aria-labelledby="landing-title">
                <div className="landing-hero__shade" aria-hidden="true" />
                <div className="landing-hero__content">
                    <img
                        className="landing-hero__logo"
                        src={eagleLogo}
                        width="190"
                        height="190"
                        alt="Эмблема Казачьего круга"
                    />
                    <h1 id="landing-title">{landingHero.title}</h1>
                    <p className="landing-hero__subtitle">{landingHero.subtitle}</p>
                    <div className="landing-hero__actions">
                        <Link className="landing-hero__login" to={landingHero.loginHref}>
                            {landingHero.loginLabel}
                        </Link>
                        <Link className="landing-hero__register" to={landingHero.registerHref}>
                            {landingHero.registerLabel}
                        </Link>
                    </div>
                </div>
            </section>

            <section className="landing-features" aria-label="О Казачьем круге">
                {landingSections.map((section) => (
                    <article className="landing-feature" id={section.id} key={section.id}>
                        <p className="landing-feature__eyebrow">{section.eyebrow}</p>
                        <h2>{section.title}</h2>
                        <p>{section.text}</p>
                    </article>
                ))}
            </section>

            <footer className="landing-footer">
                <p className="landing-footer__text">
                    КАЗАЧИЙ КРУГ  V.1
                </p>
                <a
                    className="landing-footer__studio"
                    href={landingBranding.studioHref}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {landingBranding.studioLabel}
                </a>
            </footer>
        </main>
    );
}
