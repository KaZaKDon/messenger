export const ADMIN_ROLES = new Set(["admin", "moderator"]);

const NAVIGATION = [
    { id: "overview", path: "/admin/overview", label: "Обзор", icon: "⌂", roles: ["admin", "moderator"] },
    { id: "users", path: "/admin/users", label: "Пользователи", icon: "👥", roles: ["admin", "moderator"] },
    { id: "groups", path: "/admin/groups", label: "Группы", icon: "◉", roles: ["admin", "moderator"] },
    { id: "settlements", path: "/admin/settlements", label: "Населённые пункты", icon: "⌖", roles: ["admin"] },
    { id: "advertisements", path: "/admin/advertisements", label: "Объявления", icon: "▤", roles: ["admin", "moderator"] },
    { id: "complaints", path: "/admin/complaints", label: "Жалобы", icon: "⚑", roles: ["admin", "moderator"] },
    { id: "support", path: "/admin/support-requests", label: "Обращения", icon: "✉", roles: ["admin", "moderator"] },
    { id: "payments", path: "/admin/payments", label: "Оплата", icon: "₽", roles: ["admin"] },
    { id: "moderators", path: "/admin/moderators", label: "Модераторы", icon: "◇", roles: ["admin"] },
];

export function isAdminRole(role) {
    return ADMIN_ROLES.has(role);
}

export function getAdminNavigation(role) {
    return NAVIGATION.filter((item) => item.roles.includes(role));
}

export function canOpenAdminSection(role, sectionId) {
    return getAdminNavigation(role).some((item) => item.id === sectionId);
}

export function getAdminPageTitle(pathname, role) {
    if (pathname === "/admin/users/registrations") return "Заявки на регистрацию";
    if (pathname === "/admin/users/password-recoveries") return "Восстановление пароля";
    const item = getAdminNavigation(role).find(({ path }) => pathname.startsWith(path));
    return item?.label ?? (role === "admin" ? "Админка" : "Модерация");
}
