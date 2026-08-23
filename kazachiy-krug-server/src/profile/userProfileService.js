import { DomainError, normalizeRequiredText } from "../domain/DomainError.js";

const FIELD_RULES = Object.freeze({
    settlement: { label: "Населённый пункт", min: 2, max: 120 },
    occupation: { label: "Занятие", min: 2, max: 160 },
});

export function profilePayload(user, profile = null) {
    return {
        id: user.id,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar ?? null,
        settlement: profile?.settlement ?? null,
        occupation: profile?.occupation ?? null,
    };
}

export async function getUserProfile({ prisma, user }) {
    const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });
    return profilePayload(user, profile);
}

export async function updateUserProfile({ prisma, user, source }) {
    const data = {};

    for (const [field, rules] of Object.entries(FIELD_RULES)) {
        if (Object.hasOwn(source ?? {}, field)) {
            data[field] = normalizeRequiredText(source[field], { field, ...rules });
        }
    }

    if (Object.keys(data).length === 0) {
        throw new DomainError("Укажите населённый пункт или занятие", {
            code: "VALIDATION_ERROR",
            statusCode: 400,
        });
    }

    const profile = await prisma.userProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...data },
        update: data,
    });
    return profilePayload(user, profile);
}
