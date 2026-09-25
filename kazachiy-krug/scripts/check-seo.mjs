import { readFile } from "node:fs/promises";

const html = await readFile("dist/index.html", "utf8");
const robots = await readFile("dist/robots.txt", "utf8");
const sitemap = await readFile("dist/sitemap.xml", "utf8");
const htaccess = await readFile("dist/.htaccess", "utf8");
const notFound = await readFile("dist/404.html", "utf8");

const requiredHtml = [
    '<html lang="ru">',
    "Казачий круг — мессенджер для общения и местных объявлений",
    'rel="canonical" href="https://kazachiy-krug.best/"',
    'property="og:image" content="https://kazachiy-krug.best/og-kazachiy-krug.png"',
    'name="twitter:card" content="summary_large_image"',
    'class="landing-hero"',
    'href="/phone?mode=register"',
    "https://vkazakdon.ru",
    "КАЗАЧИЙ КРУГ V.1",
    'application/ld+json',
];

for (const marker of requiredHtml) {
    if (!html.includes(marker)) throw new Error(`В сборке отсутствует SEO-маркер: ${marker}`);
}

if (!robots.includes("https://kazachiy-krug.best/sitemap.xml")) {
    throw new Error("robots.txt не содержит адрес карты сайта");
}

if (!sitemap.includes("<loc>https://kazachiy-krug.best/</loc>")) {
    throw new Error("Главная страница отсутствует в sitemap.xml");
}

if (!htaccess.includes("ErrorDocument 404 /404.html")) {
    throw new Error(".htaccess не содержит отдельную страницу HTTP 404");
}

if (!htaccess.includes("RewriteRule ^ - [R=404,L]")) {
    throw new Error(".htaccess не возвращает HTTP 404 для неизвестных маршрутов");
}

for (const routeMarker of ["phone|code|chat|settings", "admin/users"]) {
    if (!htaccess.includes(routeMarker)) {
        throw new Error(`.htaccess не сохраняет SPA-маршрут: ${routeMarker}`);
    }
}

if (!notFound.includes('name="robots" content="noindex, nofollow"')) {
    throw new Error("404.html должна быть закрыта от индексации");
}

console.log("SEO-проверка пройдена");
