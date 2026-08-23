export function getInitialAuthMode({ search = "", hasPendingRegistration = false } = {}) {
    if (hasPendingRegistration) return "pending";
    return new URLSearchParams(search).get("mode") === "register" ? "register" : "login";
}
