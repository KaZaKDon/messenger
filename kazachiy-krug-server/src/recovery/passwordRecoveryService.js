import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { hashPassword } from "../auth/password.js";
import { normalizeRussianMobilePhone } from "../registration/phone.js";

export const RECOVERY_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const RECENT_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const MAX_RECENT_REQUESTS = 5;

export class PasswordRecoveryError extends Error {
    constructor(statusCode, message, field = null) {
        super(message);
        this.name = "PasswordRecoveryError";
        this.statusCode = statusCode;
        this.field = field;
    }
}

function hashSecret(secret) {
    return createHash("sha256").update(secret).digest("hex");
}

function secretMatches(secret, expectedHash) {
    if (typeof secret !== "string" || !expectedHash) return false;
    const actual = Buffer.from(hashSecret(secret), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function newBrowserCredential() {
    const browserSecret = randomBytes(32).toString("base64url");
    return { browserSecret, clientSecretHash: hashSecret(browserSecret) };
}

async function allocateRequestCode(prisma, now, randomIntFn = randomInt) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const requestCode = String(randomIntFn(1_000, 10_000));
        const exists = await prisma.passwordRecoveryRequest.findFirst({
            where: {
                requestCode,
                status: { in: ["pending", "approved"] },
                expiresAt: { gt: now },
            },
            select: { id: true },
        });
        if (!exists) return requestCode;
    }
    throw new Error("Could not allocate a password recovery code");
}

function publicRequest(request, browserSecret, contact = {}) {
    return {
        recoveryId: request.id,
        browserSecret,
        requestCode: request.requestCode,
        status: request.status,
        expiresAt: request.expiresAt,
        ...contact,
    };
}

function fakeRequest({ now, contact, randomIntFn = randomInt }) {
    const { browserSecret } = newBrowserCredential();
    return publicRequest({
        id: randomBytes(16).toString("hex"),
        requestCode: String(randomIntFn(1_000, 10_000)),
        status: "pending",
        expiresAt: new Date(now.getTime() + RECOVERY_TTL_MS),
    }, browserSecret, contact);
}

export async function createPasswordRecoveryRequest({
    prisma,
    phone: sourcePhone,
    contact = {},
    now = new Date(),
    randomIntFn = randomInt,
}) {
    const phone = normalizeRussianMobilePhone(sourcePhone);
    if (!phone) {
        throw new PasswordRecoveryError(400, "Введите российский мобильный номер в формате +7 (999) 123-45-67", "phone");
    }

    const user = await prisma.user.findUnique({
        where: { phone },
        select: { id: true, status: true },
    });
    if (!user || user.status !== "active") {
        return fakeRequest({ now, contact, randomIntFn });
    }

    const recentCount = await prisma.passwordRecoveryRequest.count({
        where: {
            userId: user.id,
            createdAt: { gte: new Date(now.getTime() - RECENT_REQUEST_WINDOW_MS) },
        },
    });
    if (recentCount >= MAX_RECENT_REQUESTS) {
        return fakeRequest({ now, contact, randomIntFn });
    }

    const requestCode = await allocateRequestCode(prisma, now, randomIntFn);
    const { browserSecret, clientSecretHash } = newBrowserCredential();
    const expiresAt = new Date(now.getTime() + RECOVERY_TTL_MS);
    const request = await prisma.$transaction(async (tx) => {
        await tx.passwordRecoveryRequest.updateMany({
            where: { userId: user.id, status: { in: ["pending", "approved"] } },
            data: { status: "superseded", resolvedAt: now },
        });
        return tx.passwordRecoveryRequest.create({
            data: {
                userId: user.id,
                requestCode,
                clientSecretHash,
                status: "pending",
                expiresAt,
            },
        });
    });
    return publicRequest(request, browserSecret, contact);
}

async function findAuthorizedRequest(prisma, recoveryId, browserSecret) {
    if (typeof recoveryId !== "string" || !recoveryId || typeof browserSecret !== "string") return null;
    const request = await prisma.passwordRecoveryRequest.findUnique({ where: { id: recoveryId } });
    return request && secretMatches(browserSecret, request.clientSecretHash) ? request : null;
}

export async function getPasswordRecoveryStatus({ prisma, recoveryId, browserSecret, now = new Date() }) {
    const request = await findAuthorizedRequest(prisma, recoveryId, browserSecret);
    if (!request) return { status: "pending" };
    if (["pending", "approved"].includes(request.status) && request.expiresAt <= now) {
        await prisma.passwordRecoveryRequest.update({
            where: { id: request.id },
            data: { status: "expired", resolvedAt: now },
        });
        return { status: "expired", expiresAt: request.expiresAt };
    }
    return { status: request.status, expiresAt: request.expiresAt };
}

function validateNewPassword(source = {}) {
    const password = typeof source.password === "string" ? source.password : "";
    if (password.length < 8 || password.length > 128) {
        throw new PasswordRecoveryError(400, "Пароль должен содержать от 8 до 128 символов", "password");
    }
    if (source.passwordConfirmation !== password) {
        throw new PasswordRecoveryError(400, "Пароли не совпадают", "passwordConfirmation");
    }
    return password;
}

export async function completePasswordRecovery({
    prisma,
    source,
    now = new Date(),
    hashPasswordFn = hashPassword,
}) {
    const password = validateNewPassword(source);
    const request = await findAuthorizedRequest(prisma, source.recoveryId, source.browserSecret);
    if (!request) throw new PasswordRecoveryError(404, "Заявка недействительна или уже закрыта");
    if (request.expiresAt <= now) {
        await prisma.passwordRecoveryRequest.update({
            where: { id: request.id },
            data: { status: "expired", resolvedAt: now },
        });
        throw new PasswordRecoveryError(410, "Срок действия заявки истёк");
    }
    if (request.status !== "approved") {
        throw new PasswordRecoveryError(409, "Администратор ещё не разрешил смену пароля");
    }

    const passwordHash = await hashPasswordFn(password);
    await prisma.$transaction(async (tx) => {
        const claimed = await tx.passwordRecoveryRequest.updateMany({
            where: { id: request.id, status: "approved" },
            data: { status: "completed", completedAt: now, resolvedAt: now, clientSecretHash: null },
        });
        if (claimed.count !== 1) {
            throw new PasswordRecoveryError(409, "Заявка уже использована");
        }
        await tx.user.update({ where: { id: request.userId }, data: { passwordHash } });
        await tx.session.deleteMany({ where: { userId: request.userId } });
        await tx.auditLog.create({
            data: {
                adminId: request.reviewedById,
                action: "password_recovery.completed",
                targetId: request.userId,
                details: { requestId: request.id },
            },
        });
    });
    return { status: "completed" };
}

function cleanReason(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function reviewPasswordRecovery({ prisma, requestId, adminId, source, now = new Date() }) {
    const decision = source?.decision;
    if (!['approve', 'reject'].includes(decision)) {
        throw new PasswordRecoveryError(400, "Укажите решение по заявке");
    }
    const reason = cleanReason(source?.reason);
    if (reason.length > 500 || (decision === "reject" && reason.length < 3)) {
        throw new PasswordRecoveryError(400, "Укажите причину отклонения от 3 до 500 символов", "reason");
    }
    const request = await prisma.passwordRecoveryRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new PasswordRecoveryError(404, "Заявка не найдена");
    if (request.status !== "pending") throw new PasswordRecoveryError(409, "Заявка уже обработана");
    if (request.expiresAt <= now) {
        await prisma.passwordRecoveryRequest.update({
            where: { id: request.id },
            data: { status: "expired", resolvedAt: now },
        });
        throw new PasswordRecoveryError(410, "Срок действия заявки истёк");
    }

    const status = decision === "approve" ? "approved" : "rejected";
    const resolvedAt = decision === "reject" ? now : null;
    const updated = await prisma.$transaction(async (tx) => {
        const changed = await tx.passwordRecoveryRequest.updateMany({
            where: { id: request.id, status: "pending" },
            data: { status, reviewedById: adminId, reviewedAt: now, reviewReason: reason || null, resolvedAt },
        });
        if (changed.count !== 1) {
            throw new PasswordRecoveryError(409, "Заявка уже обработана");
        }
        await tx.auditLog.create({
            data: {
                adminId,
                action: `password_recovery.${decision}`,
                targetId: request.userId,
                details: { requestId: request.id, reason: reason || null },
            },
        });
        return { ...request, status, reviewedById: adminId, reviewedAt: now, reviewReason: reason || null, resolvedAt };
    });
    return updated;
}
