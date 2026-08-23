import { DomainError, requireRole } from "../domain/DomainError.js";

export async function setModeratorRole({ prisma, actor, userId, assigned }) {
    requireRole(actor, ["admin"]);
    if (actor.id === userId) {
        throw new DomainError("Нельзя изменить роль собственного аккаунта", {
            code: "SELF_ROLE_CHANGE_FORBIDDEN",
            statusCode: 409,
        });
    }

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
    if (target.role === "admin") {
        throw new DomainError("Роль администратора защищена", {
            code: "ADMIN_PROTECTED",
            statusCode: 409,
        });
    }
    if (target.status === "deleted") {
        throw new DomainError("Удалённому аккаунту нельзя изменить роль", {
            code: "USER_DELETED",
            statusCode: 409,
        });
    }

    const nextRole = assigned ? "moderator" : "user";
    if (target.role === nextRole) {
        throw new DomainError(
            assigned ? "Пользователь уже является модератором" : "Роль модератора уже снята",
            { code: "ROLE_ALREADY_SET", statusCode: 409 },
        );
    }
    if (assigned && (target.role !== "user" || target.status !== "active")) {
        throw new DomainError("Назначить модератором можно только активного пользователя", {
            code: "INVALID_MODERATOR_CANDIDATE",
            statusCode: 409,
        });
    }
    if (!assigned && target.role !== "moderator") {
        throw new DomainError("У пользователя нет роли модератора", {
            code: "NOT_A_MODERATOR",
            statusCode: 409,
        });
    }

    return prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
            where: { id: userId },
            data: { role: nextRole },
        });
        await tx.session.deleteMany({ where: { userId } });
        await tx.auditLog.create({
            data: {
                adminId: actor.id,
                action: assigned ? "moderator.assign" : "moderator.remove",
                targetId: userId,
                details: { previousRole: target.role, nextRole },
            },
        });
        return user;
    });
}
