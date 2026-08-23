export const PUBLIC_SITE_URL = "https://kazachiy-krug.best";
export const DEFAULT_TITLE = "Казачий круг — мессенджер для общения и местных объявлений";
export const DEFAULT_DESCRIPTION = "Казачий круг — мессенджер с тематическими группами, местными объявлениями, личными чатами, аудио- и видеозвонками.";

export function getRouteSeo(pathname) {
    if (pathname === "/") {
        return {
            title: DEFAULT_TITLE,
            description: DEFAULT_DESCRIPTION,
            robots: "index, follow",
            canonical: `${PUBLIC_SITE_URL}/`,
        };
    }

    return {
        title: "Казачий круг",
        description: "Закрытый раздел мессенджера «Казачий круг».",
        robots: "noindex, nofollow",
        canonical: null,
    };
}
