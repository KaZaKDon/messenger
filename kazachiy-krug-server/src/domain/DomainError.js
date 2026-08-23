export class DomainError extends Error {
    constructor(message, { code = "DOMAIN_ERROR", statusCode = 400, field = null } = {}) {
        super(message);
        this.name = "DomainError";
        this.code = code;
        this.statusCode = statusCode;
        this.field = field;
    }
}

export function requireRole(actor, allowedRoles) {
    if (!actor?.id || !allowedRoles.includes(actor.role)) {
        throw new DomainError("Недостаточно прав", {
            code: "FORBIDDEN",
            statusCode: 403,
        });
    }
}

export function requireActiveActor(actor) {
    if (!actor?.id || actor.status !== "active") {
        throw new DomainError("Аккаунт неактивен", {
            code: "ACCOUNT_INACTIVE",
            statusCode: 403,
        });
    }
}

export function normalizeRequiredText(value, {
    field,
    label,
    min = 1,
    max,
}) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (normalized.length < min || normalized.length > max) {
        throw new DomainError(`${label}: от ${min} до ${max} символов`, {
            code: "VALIDATION_ERROR",
            field,
        });
    }
    return normalized;
}

export function normalizeOptionalText(value, { field, label, max }) {
    if (value == null || value === "") return null;
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized || normalized.length > max) {
        throw new DomainError(`${label}: не более ${max} символов`, {
            code: "VALIDATION_ERROR",
            field,
        });
    }
    return normalized;
}
