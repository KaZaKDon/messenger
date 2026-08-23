export const REGISTRATION_PURPOSES = Object.freeze([
    { value: "community", label: "Общение в сообществе" },
    { value: "information", label: "Получение полезной информации" },
    { value: "find_offers", label: "Поиск объявлений и предложений" },
    { value: "publish_announcements", label: "Публикация объявлений" },
    { value: "represent_organization", label: "Представление организации" },
    { value: "other", label: "Другая цель" },
]);

export const EMPTY_REGISTRATION = Object.freeze({
    nickname: "",
    phone: "",
    email: "",
    password: "",
    passwordConfirmation: "",
    firstName: "",
    lastName: "",
    settlement: "",
    occupation: "",
    purposes: [],
    purposeNote: "",
    acceptances: {
        termsRules: false,
        personalData: false,
        publicProfile: false,
    },
});

export function createEmptyRegistration() {
    return {
        ...EMPTY_REGISTRATION,
        purposes: [],
        acceptances: { ...EMPTY_REGISTRATION.acceptances },
    };
}

export function formatRussianPhoneInput(value) {
    if (typeof value !== "string" || value.trim() === "") return "";

    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("8") || digits.startsWith("7")) digits = digits.slice(1);
    digits = digits.slice(0, 10);

    let result = "+7";
    if (digits.length > 0) result += ` (${digits.slice(0, 3)}`;
    if (digits.length >= 3) result += ")";
    if (digits.length > 3) result += ` ${digits.slice(3, 6)}`;
    if (digits.length > 6) result += `-${digits.slice(6, 8)}`;
    if (digits.length > 8) result += `-${digits.slice(8, 10)}`;
    return result;
}

export function isAccountStepValid(application) {
    if (application.nickname.trim().length < 2) {
        return "Введите ник: не менее двух символов";
    }
    if (application.phone.replace(/\D/g, "").length !== 11) {
        return "Введите российский мобильный номер полностью";
    }
    if (application.password.length < 8) {
        return "Пароль должен содержать не менее 8 символов";
    }
    if (application.password !== application.passwordConfirmation) {
        return "Пароли не совпадают";
    }
    return "";
}
