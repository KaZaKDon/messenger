export const staffPrivateProfileSelect = Object.freeze({
    profile: {
        select: {
            settlement: true,
            occupation: true,
        },
    },
    registrationApplication: {
        select: {
            firstName: true,
            lastName: true,
            settlement: true,
            occupation: true,
            purposes: true,
            purposeNote: true,
        },
    },
});

export function withStaffPrivateProfile(user) {
    const {
        profile = null,
        registrationApplication = null,
        ...publicFields
    } = user ?? {};

    return {
        ...publicFields,
        privateProfile: {
            firstName: registrationApplication?.firstName ?? null,
            lastName: registrationApplication?.lastName ?? null,
            settlement: profile?.settlement ?? registrationApplication?.settlement ?? null,
            occupation: profile?.occupation ?? registrationApplication?.occupation ?? null,
            purposes: Array.isArray(registrationApplication?.purposes)
                ? registrationApplication.purposes
                : [],
            purposeNote: registrationApplication?.purposeNote ?? null,
        },
    };
}
