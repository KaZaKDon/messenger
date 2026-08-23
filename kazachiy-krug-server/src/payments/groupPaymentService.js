import {
    DomainError,
    normalizeOptionalText,
    normalizeRequiredText,
    requireRole,
} from "../domain/DomainError.js";

function requiredDate(value, field, label) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (!Number.isFinite(date.getTime())) {
        throw new DomainError(`Укажите ${label.toLowerCase()}`, {
            code: "VALIDATION_ERROR",
            field,
        });
    }
    return date;
}

function normalizeAmount(value) {
    const normalized = typeof value === "string"
        ? value.trim().replace(",", ".")
        : String(value ?? "");
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(normalized) || Number(normalized) <= 0) {
        throw new DomainError("Укажите положительную сумму с точностью до копеек", {
            code: "VALIDATION_ERROR",
            field: "amount",
        });
    }
    return Number(normalized).toFixed(2);
}

export async function recordGroupPayment({ prisma, actor, source }) {
    requireRole(actor, ["admin"]);
    const chatId = normalizeRequiredText(source?.chatId, {
        field: "chatId",
        label: "Группа",
        min: 1,
        max: 200,
    });
    const ownerId = source?.ownerId == null || source.ownerId === ""
        ? null
        : normalizeRequiredText(source.ownerId, {
            field: "ownerId",
            label: "Владелец группы",
            min: 1,
            max: 200,
        });
    const amount = normalizeAmount(source?.amount);
    const paidAt = requiredDate(source?.paidAt, "paidAt", "Дату оплаты");
    const periodStartsAt = requiredDate(source?.periodStartsAt, "periodStartsAt", "Начало периода");
    const periodEndsAt = requiredDate(source?.periodEndsAt, "periodEndsAt", "Конец периода");
    if (periodEndsAt <= periodStartsAt) {
        throw new DomainError("Конец оплаченного периода должен быть позже начала", {
            code: "INVALID_PAYMENT_PERIOD",
            field: "periodEndsAt",
        });
    }
    const comment = normalizeOptionalText(source?.comment, {
        field: "comment",
        label: "Комментарий",
        max: 1000,
    });
    const groupRule = await prisma.groupRule.findUnique({
        where: { chatId },
        select: { chatId: true, ownerId: true },
    });
    if (!groupRule) {
        throw new DomainError("Группа не найдена", {
            code: "GROUP_NOT_FOUND",
            statusCode: 404,
        });
    }
    if (ownerId) {
        const owner = await prisma.user.findUnique({
            where: { id: ownerId },
            select: { id: true, status: true },
        });
        if (!owner || owner.status === "deleted") {
            throw new DomainError("Владелец группы не найден", {
                code: "OWNER_NOT_FOUND",
                statusCode: 404,
            });
        }
    }

    return prisma.$transaction(async (tx) => {
        const payment = await tx.groupPayment.create({
            data: {
                chatId,
                ownerId,
                amount,
                currency: "RUB",
                paidAt,
                periodStartsAt,
                periodEndsAt,
                comment,
                status: "recorded",
                recordedById: actor.id,
            },
        });
        await tx.auditLog.create({
            data: {
                adminId: actor.id,
                action: "group_payment.record",
                targetId: payment.id,
                details: { chatId, ownerId, amount, periodStartsAt, periodEndsAt },
            },
        });
        return payment;
    });
}

export async function voidGroupPayment({
    prisma,
    actor,
    paymentId,
    reason,
    now = new Date(),
}) {
    requireRole(actor, ["admin"]);
    const normalizedReason = normalizeRequiredText(reason, {
        field: "reason",
        label: "Причина отмены записи",
        min: 3,
        max: 1000,
    });
    const payment = await prisma.groupPayment.findUnique({
        where: { id: paymentId },
        select: { id: true, status: true },
    });
    if (!payment) {
        throw new DomainError("Запись об оплате не найдена", {
            code: "PAYMENT_NOT_FOUND",
            statusCode: 404,
        });
    }
    if (payment.status === "voided") {
        throw new DomainError("Запись об оплате уже отменена", {
            code: "PAYMENT_ALREADY_VOIDED",
            statusCode: 409,
        });
    }

    return prisma.$transaction(async (tx) => {
        const updated = await tx.groupPayment.update({
            where: { id: paymentId },
            data: {
                status: "voided",
                voidedAt: now,
                voidedById: actor.id,
                voidReason: normalizedReason,
            },
        });
        await tx.auditLog.create({
            data: {
                adminId: actor.id,
                action: "group_payment.void",
                targetId: paymentId,
                details: { reason: normalizedReason },
            },
        });
        return updated;
    });
}
