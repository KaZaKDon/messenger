import { formatRussianMobilePhone, normalizeRussianMobilePhone } from "./phone.js";

const DEFAULT_DOCUMENT_VERSION = "2026-08-27";

export class RegistrationConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = "RegistrationConfigError";
    }
}

function clean(value) {
    return typeof value === "string" ? value.trim() : "";
}

function documentVersion(env, name) {
    return clean(env[name]) || DEFAULT_DOCUMENT_VERSION;
}

export function readRegistrationConfig(env = process.env) {
    const contactPhone = normalizeRussianMobilePhone(env.REGISTRATION_CONTACT_PHONE);
    if (!contactPhone) {
        throw new RegistrationConfigError(
            "REGISTRATION_CONTACT_PHONE must contain a valid Russian mobile phone",
        );
    }

    return {
        contactPhone,
        contactPhoneDisplay: formatRussianMobilePhone(contactPhone),
        documentVersions: {
            terms_rules: documentVersion(env, "REGISTRATION_TERMS_RULES_VERSION"),
            personal_data: documentVersion(env, "REGISTRATION_PERSONAL_DATA_VERSION"),
            public_profile: documentVersion(env, "REGISTRATION_PUBLIC_PROFILE_VERSION"),
        },
    };
}
