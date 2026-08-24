export const landingHero = {
    title: "Казачий круг",
    subtitle: "Здесь собираются свои",
    loginLabel: "Войти",
    loginHref: "/phone",
    registerLabel: "Подать заявку на регистрацию",
    registerHref: "/phone?mode=register",
};

export const landingBranding = {
    productLabel: "КАЗАЧИЙ КРУГ V.1",
    studioLabel: "VKazakDon Studio",
    studioHref: "https://vkazakdon.ru",
};

export const landingSections = [
    {
        id: "possibilities",
        eyebrow: "Общение рядом",
        title: "Всё нужное в одном кругу",
        text: "Тематические группы, личные чаты, аудио- и видеозвонки помогают оставаться на связи со своими.",
    },
    {
        id: "advertisements",
        eyebrow: "Местные объявления",
        title: "Предложения от людей поблизости",
        text: "Публикуйте объявления по категориям, находите товары и услуги и сразу связывайтесь с автором.",
    },
    {
        id: "registration",
        eyebrow: "Вход по заявке",
        title: "Регистрация с подтверждением",
        text: "Новый участник подаёт заявку, сообщает администратору короткий код и после подтверждения входит по номеру телефона.",
    },
    {
        id: "safety",
        eyebrow: "Порядок и безопасность",
        title: "Модерация без чтения личных чатов",
        text: "Жалобы рассматривают администратор и модераторы. Личную переписку участники контролируют сами.",
    },
];

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function renderLandingSeoMarkup({
    eagleLogoUrl = "/favicon-kazachiy-krug.svg",
} = {}) {
    const sections = landingSections.map((section) => `
        <article class="landing-feature" id="${escapeHtml(section.id)}">
            <p class="landing-feature__eyebrow">${escapeHtml(section.eyebrow)}</p>
            <h2>${escapeHtml(section.title)}</h2>
            <p>${escapeHtml(section.text)}</p>
        </article>`).join("");

    return `<main class="landing-page">
        <section class="landing-hero" aria-labelledby="landing-title">
            <div class="landing-hero__shade"></div>
            <div class="landing-hero__content">
                <img class="landing-hero__logo" src="${escapeHtml(eagleLogoUrl)}" width="190" height="190" alt="Эмблема Казачьего круга">
                <h1 id="landing-title">${escapeHtml(landingHero.title)}</h1>
                <p class="landing-hero__subtitle">${escapeHtml(landingHero.subtitle)}</p>
                <div class="landing-hero__actions">
                    <a class="landing-hero__login" href="${escapeHtml(landingHero.loginHref)}">${escapeHtml(landingHero.loginLabel)}</a>
                    <a class="landing-hero__register" href="${escapeHtml(landingHero.registerHref)}">${escapeHtml(landingHero.registerLabel)}</a>
                </div>
            </div>
        </section>
        <section class="landing-features" aria-label="О Казачьем круге">${sections}
        </section>
        <footer class="landing-footer">
            <p class="landing-footer__text">${escapeHtml(landingBranding.productLabel)}</p>
            <a class="landing-footer__studio" href="${escapeHtml(landingBranding.studioHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(landingBranding.studioLabel)}</a>
        </footer>
    </main>`;
}
