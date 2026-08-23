import {
    DomainError,
    normalizeRequiredText,
    requireRole,
} from "../domain/DomainError.js";

function auditData(actorId, action, targetId, details) {
    return { adminId: actorId, action, targetId, details };
}

function assertTargetCanBeModerated({ actor, target, action }) {
    if (!target) {
        throw new DomainError("Пользователь не найден", {
            code: "USER_NOT_FOUND",
            statusCode: 404,
        });
    }
    if (target.role === "admin") {
        throw new DomainError(`Администратора нельзя ${action}`, {
            code: "ADMIN_PROTECTED",
            statusCode: 409,
        });
    }
    if (actor.role === "moderator" && target.role !== "user") {
        throw new DomainError("Модератор может блокировать только обычных пользователей", {
            code: "ROLE_PROTECTED",
            statusCode: 403,
        });
    }
    if (target.status === "deleted") {
        throw new DomainError("Аккаунт уже удалён", {
            code: "USER_DELETED",
            statusCode: 409,
        });
    }
}

export async function blockUser({ prisma, actor, userId, reason, now = new Date() }) {
    requireRole(actor, ["admin", "moderator"]);
    const normalizedReason = normalizeRequiredText(reason, {
        field: "reason",
        label: "Причина блокировки",
        min: 3,
        max: 500,
    });
    const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, status: true },
    });
    assertTargetCanBeModerated({ actor, target, action: "заблокировать" });
    if (target.status === "blocked") {
        throw new DomainError("Пользователь уже заблокирован", {
            code: "ALREADY_BLOCKED",
            statusCode: 409,
        });
    }

    return prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
            where: { id: userId },
            data: {
                status: "blocked",
                blockedAt: now,
                blockReason: normalizedReason,
            },
        });
        await tx.session.deleteMany({ where: { userId } });
        await tx.auditLog.create({
            data: auditData(actor.id, "user.block", userId, {
                reason: normalizedReason,
                previousStatus: target.status,
            }),
        });
        return user;
    });
}

export async function unblockUser({ prisma, actor, userId }) {
    requireRole(actor, ["admin"]);
    const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, status: true },
    });
    if (!target) {
        throw new DomainError("Пользователь не найден", {
            code: "USER_NOT_FOUND",
            statusCode: 404,
        });
    }
    if (target.status !== "blocked") {
        throw new DomainError("Аккаунт не заблокирован", {
            code: "NOT_BLOCKED",
            statusCode: 409,
        });
    }

    return prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
            where: { id: userId },
            data: { status: "active", blockedAt: null, blockReason: null },
        });
        await tx.auditLog.create({
            data: auditData(actor.id, "user.unblock", userId, null),
        });
        return user;
    });
}

export async function softDeleteUser({ prisma, actor, userId, reason, now = new Date() }) {
    requireRole(actor, ["admin"]);
    if (actor.id === userId) {
        throw new DomainError("Нельзя удалить собственный административный аккаунт", {
            code: "SELF_DELETE_FORBIDDEN",
            statusCode: 409,
        });
    }
    const normalizedReason = normalizeRequiredText(reason, {
        field: "reason",
        label: "Причина удаления",
        min: 3,
        max: 500,
    });
    const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, status: true },
    });
    assertTargetCanBeModerated({ actor, target, action: "удалить" });

    return prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
            where: { id: userId },
            data: {
                status: "deleted",
                deletedAt: now,
                deletionReason: normalizedReason,
                approvalCode: null,
                blockedAt: null,
                blockReason: null,
            },
        });
        await tx.session.deleteMany({ where: { userId } });
        await tx.advertisement.updateMany({
            where: { authorId: userId, status: { in: ["active", "needs_edit"] } },
            data: {
                status: "removed",
                moderatedById: actor.id,
                moderatedAt: now,
                moderationReason: "Аккаунт автора удалён",
            },
        });
        await tx.groupRule.updateMany({
            where: { ownerId: userId },
            data: {
                ownerId: null,
                ownershipStartsAt: null,
                ownershipEndsAt: null,
            },
        });
        await tx.groupPublisher.deleteMany({ where: { userId } });
        await tx.auditLog.create({
            data: auditData(actor.id, "user.soft_delete", userId, {
                reason: normalizedReason,
                previousStatus: target.status,
            }),
        });
        return user;
    });
}
