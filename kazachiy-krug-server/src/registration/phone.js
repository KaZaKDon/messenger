const RUSSIAN_MOBILE_RE = /^79\d{9}$/;
const PHONE_INPUT_RE = /^[+\d\s()-]+$/;

export function normalizeRussianMobilePhone(value) {
    if (typeof value !== "string") return null;

    const input = value.trim();
    if (!input || !PHONE_INPUT_RE.test(input)) return null;

    let digits = input.replace(/\D/g, "");
    if (digits.length === 10 && digits.startsWith("9")) {
        digits = `7${digits}`;
    } else if (digits.length === 11 && digits.startsWith("8")) {
        digits = `7${digits.slice(1)}`;
    }

    return RUSSIAN_MOBILE_RE.test(digits) ? `+${digits}` : null;
}

export function isRussianMobilePhone(value) {
    return normalizeRussianMobilePhone(value) !== null;
}

export function formatRussianMobilePhone(value) {
    const phone = normalizeRussianMobilePhone(value);
    if (!phone) return null;

    const digits = phone.slice(2);
    return `8 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}
