export const PROFILE_FIELDS = Object.freeze({
    settlement: { label: "Населённый пункт", placeholder: "Например, ст. Вёшенская" },
    occupation: { label: "Занятие", placeholder: "Например, пчеловод" },
});

export function profileDetails(profile = {}) {
    return {
        phone: profile.phone ?? "—",
        settlement: profile.settlement ?? "Не указано",
        occupation: profile.occupation ?? "Не указано",
    };
}
