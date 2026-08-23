const LOGIN_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function required(source, name) {
    const value = source[name]?.trim();
    if (!value) throw new Error(`${name} is required`);
    return value;
}

export function readAdminBootstrapConfig(source = process.env) {
    const userId = required(source, "ADMIN_USER_ID");
    const login = required(source, "ADMIN_LOGIN");
    const password = required(source, "ADMIN_PASSWORD");
    const email = required(source, "ADMIN_EMAIL").toLowerCase();

    if (!LOGIN_RE.test(login)) {
        throw new Error("ADMIN_LOGIN must contain 3-32 Latin letters, digits, dots, hyphens or underscores");
    }
    if (password.length < 12 || password.length > 128) {
        throw new Error("ADMIN_PASSWORD must contain 12-128 characters");
    }
    if (email.length > 254 || !EMAIL_RE.test(email)) {
        throw new Error("ADMIN_EMAIL must be a valid email address");
    }

    return { userId, login, password, email };
}
