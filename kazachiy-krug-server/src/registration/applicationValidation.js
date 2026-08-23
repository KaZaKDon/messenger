import { normalizeRussianMobilePhone } from "./phone.js";

export const REGISTRATION_APPLICATION_TTL_MS = 3 * 24 * 60 * 60 * 1_000;

export const REGISTRATION_PURPOSES = Object.freeze([
    "community",
    "information",
    "find_offers",
    "publish_announcements",
    "represent_organization",
    "other",
]);

const PURPOSE_SET = new Set(REGISTRATION_PURPOSES);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class RegistrationValidationError extends Error {
    constructor(field, message) {
        super(message);
        this.name = "RegistrationValidationError";
        this.field = field;
    }
}

function cleanText(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function requiredText(source, field, label, { min, max }) {
    const value = cleanText(source[field]);
    if (value.length < min || value.length > max) {
        throw new RegistrationValidationError(
            field,
            `${label}: от ${min} до ${max} символов`,
        );
    }
    return value;
}

function optionalText(value, field, max) {
    const normalized = cleanText(value);
    if (!normalized) return null;
    if (normalized.length > max) {
        throw new RegistrationValidationError(field, `Максимальная длина: ${max} символов`);
    }
    return normalized;
}

function optionalEmail(value) {
    const email = cleanText(value).toLowerCase();
    if (!email) return null;
    if (email.length > 254 || !EMAIL_RE.test(email)) {
        throw new RegistrationValidationError("email", "Введите корректный email");
    }
    return email;
}

function normalizePurposes(value) {
    if (!Array.isArray(value)) {
        throw new RegistrationValidationError("purposes", "Выберите хотя бы одну цель вступления");
    }

    const purposes = [...new Set(value.filter((purpose) => typeof purpose === "string"))];
    if (purposes.length === 0 || purposes.some((purpose) => !PURPOSE_SET.has(purpose))) {
        throw new RegistrationValidationError("purposes", "Выберите корректную цель вступления");
    }
    return purposes;
}

function requireAcceptances(value) {
    const acceptances = value && typeof value === "object" ? value : {};
    for (const field of ["termsRules", "personalData", "publicProfile"]) {
        if (acceptances[field] !== true) {
            throw new RegistrationValidationError(
                `acceptances.${field}`,
                "Для регистрации необходимо подтвердить все обязательные документы",
            );
        }
    }
    return {
        termsRules: true,
        personalData: true,
        publicProfile: true,
    };
}

export function buildRegistrationExpiry(now = new Date()) {
    const timestamp = now instanceof Date ? now.getTime() : Number.NaN;
    if (!Number.isFinite(timestamp)) throw new TypeError("now must be a valid Date");
    return new Date(timestamp + REGISTRATION_APPLICATION_TTL_MS);
}

export function validateRegistrationApplicationInput(source = {}) {
    const phone = normalizeRussianMobilePhone(source.phone);
    if (!phone) {
        throw new RegistrationValidationError(
            "phone",
            "Введите российский мобильный номер в формате +7 (999) 123-45-67",
        );
    }

    const password = typeof source.password === "string" ? source.password : "";
    if (password.length < 8 || password.length > 128) {
        throw new RegistrationValidationError("password", "Пароль должен содержать от 8 до 128 символов");
    }
    if (source.passwordConfirmation !== password) {
        throw new RegistrationValidationError("passwordConfirmation", "Пароли не совпадают");
    }

    const purposes = normalizePurposes(source.purposes);
    const purposeNote = optionalText(source.purposeNote, "purposeNote", 500);
    if (purposes.includes("other") && !purposeNote) {
        throw new RegistrationValidationError("purposeNote", "Поясните другую цель вступления");
    }

    return {
        nickname: requiredText(source, "nickname", "Ник", { min: 2, max: 40 }),
        phone,
        email: optionalEmail(source.email),
        password,
        firstName: requiredText(source, "firstName", "Имя", { min: 2, max: 80 }),
        lastName: requiredText(source, "lastName", "Фамилия", { min: 2, max: 80 }),
        settlement: requiredText(source, "settlement", "Населённый пункт", { min: 2, max: 120 }),
        occupation: requiredText(source, "occupation", "Род занятий", { min: 2, max: 160 }),
        purposes,
        purposeNote,
        acceptances: requireAcceptances(source.acceptances),
    };
}
