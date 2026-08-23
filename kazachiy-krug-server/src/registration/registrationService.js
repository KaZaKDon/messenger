import { randomUUID } from "node:crypto";

import { hashPassword } from "../auth/password.js";
import { allocateUniqueApprovalCode } from "./approvalCode.js";
import {
    buildRegistrationExpiry,
    validateRegistrationApplicationInput,
} from "./applicationValidation.js";

const ACCEPTANCE_TYPES = Object.freeze([
    "terms_rules",
    "personal_data",
    "public_profile",
]);

export class RegistrationConflictError extends Error {
    constructor(field, message) {
        super(message);
        this.name = "RegistrationConflictError";
        this.field = field;
    }
}

function optionalMetadata(value, maxLength) {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized ? normalized.slice(0, maxLength) : null;
}

function conflictFromDuplicate(duplicate, input) {
    if (duplicate.phone === input.phone) {
        return new RegistrationConflictError("phone", "Телефон уже зарегистрирован");
    }
    return new RegistrationConflictError("email", "Email уже зарегистрирован");
}

function isUniqueConstraintError(error) {
    return error?.code === "P2002";
}

export async function createRegistrationApplication({
    prisma,
    source,
    config,
    metadata = {},
    now = new Date(),
    createId = randomUUID,
    hashPasswordFn = hashPassword,
}) {
    const input = validateRegistrationApplicationInput(source);
    const duplicateConditions = [{ phone: input.phone }];
    if (input.email) duplicateConditions.push({ email: input.email });

    const duplicate = await prisma.user.findFirst({
        where: { OR: duplicateConditions },
        select: { phone: true, email: true },
    });
    if (duplicate) throw conflictFromDuplicate(duplicate, input);

    const approvalCode = await allocateUniqueApprovalCode({
        isTaken: async (code) => Boolean(await prisma.registrationApplication.findUnique({
            where: { approvalCode: code },
            select: { id: true },
        })),
    });
    const userId = createId();
    const passwordHash = await hashPasswordFn(input.password);
    const expiresAt = buildRegistrationExpiry(now);
    const acceptedAt = new Date(now);

    try {
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    id: userId,
                    login: null,
                    email: input.email,
                    passwordHash,
                    phone: input.phone,
                    name: input.nickname,
                    approvalCode: null,
                    status: "pending",
                },
            });
            const application = await tx.registrationApplication.create({
                data: {
                    userId,
                    firstName: input.firstName,
                    lastName: input.lastName,
                    settlement: input.settlement,
                    occupation: input.occupation,
                    purposes: input.purposes,
                    purposeNote: input.purposeNote,
                    approvalCode,
                    expiresAt,
                },
            });
            await tx.userProfile.create({
                data: {
                    userId,
                    settlement: input.settlement,
                    occupation: input.occupation,
                },
            });
            await tx.legalAcceptance.createMany({
                data: ACCEPTANCE_TYPES.map((type) => ({
                    userId,
                    type,
                    documentVersion: config.documentVersions[type],
                    source: "registration",
                    acceptedAt,
                    ipAddress: optionalMetadata(metadata.ipAddress, 64),
                    userAgent: optionalMetadata(metadata.userAgent, 500),
                })),
            });
            return { user, application };
        });

        return {
            ...result,
            approvalCode,
            expiresAt,
            contactPhone: config.contactPhone,
            contactPhoneDisplay: config.contactPhoneDisplay,
        };
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            throw new RegistrationConflictError(
                "account",
                "Телефон, email или код заявки уже используются. Повторите регистрацию",
            );
        }
        throw error;
    }
}
