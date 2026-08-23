import {
    DomainError,
    normalizeOptionalText,
    normalizeRequiredText,
    requireActiveActor,
    requireRole,
} from "../domain/DomainError.js";

const TARGET_TYPES = new Set(["advertisement", "message", "user", "group"]);
const REVIEW_STATUSES = new Set(["in_review", "resolved", "rejected"]);
const ADVERTISEMENT_ACTIONS = new Set(["none", "needs_edit", "removed"]);

async function resolveComplaintTarget(prisma, targetType, targetId) {
    switch (targetType) {
        case "advertisement": {
            const item = await prisma.advertisement.findUnique({
                where: { id: targetId },
                select: {
                    id: true,
                    chatId: true,
                    title: true,
                    settlement: true,
                    price: true,
                    description: true,
                    authorId: true,
                    status: true,
                    publishedAt: true,
                    images: { orderBy: { sortOrder: "asc" }, select: { url: true, sortOrder: true } },
                    groupRule: { select: { chat: { select: { title: true } } } },
                },
            });
            return item && {
                id: item.id,
                chatId: item.chatId,
                groupTitle: item.groupRule?.chat?.title ?? item.chatId,
                title: item.title,
                settlement: item.settlement,
                price: item.price,
                description: item.description,
                authorId: item.authorId,
                status: item.status,
                publishedAt: item.publishedAt,
                images: item.images,
            };
        }
        case "message": {
            const item = await prisma.message.findUnique({
                where: { id: targetId },
                select: { id: true, chatId: true, senderId: true, text: true, createdAt: true },
            });
            return item && {
                chatId: item.chatId,
                senderId: item.senderId,
                text: item.text.slice(0, 500),
                createdAt: item.createdAt,
            };
        }
        case "user": {
            const item = await prisma.user.findUnique({
                where: { id: targetId },
                select: { id: true, name: true, role: true, status: true },
            });
            return item && { name: item.name, role: item.role, status: item.status };
        }
        case "group": {
            const item = await prisma.chat.findUnique({
                where: { id: targetId },
                select: { id: true, type: true, title: true },
            });
            return item?.type === "group" ? { title: item.title } : null;
        }
        default:
            return null;
    }
}

export async function createComplaint({ prisma, actor, source }) {
    requireActiveActor(actor);
    const targetType = typeof source?.targetType === "string" ? source.targetType : "";
    if (!TARGET_TYPES.has(targetType)) {
        throw new DomainError("Выберите, на что подаётся жалоба", {
            code: "VALIDATION_ERROR",
            field: "targetType",
        });
    }
    const targetId = normalizeRequiredText(source.targetId, {
        field: "targetId",
        label: "Объект жалобы",
        min: 1,
        max: 200,
    });
    if (targetType === "user" && targetId === actor.id) {
        throw new DomainError("Нельзя подать жалобу на самого себя", {
            code: "SELF_COMPLAINT",
            statusCode: 409,
        });
    }
    const reason = normalizeRequiredText(source.reason, {
        field: "reason",
        label: "Причина жалобы",
        min: 3,
        max: 160,
    });
    const details = normalizeOptionalText(source.details, {
        field: "details",
        label: "Описание жалобы",
        max: 3000,
    });
    const targetSnapshot = await resolveComplaintTarget(prisma, targetType, targetId);
    if (!targetSnapshot) {
        throw new DomainError("Объект жалобы не найден", {
            code: "COMPLAINT_TARGET_NOT_FOUND",
            statusCode: 404,
        });
    }
    if (targetType === "advertisement") {
        if (targetSnapshot.authorId === actor.id) {
            throw new DomainError("Нельзя пожаловаться на собственное объявление", {
                code: "SELF_COMPLAINT",
                statusCode: 409,
            });
        }
        if (targetSnapshot.status !== "active") {
            throw new DomainError("Это объявление уже недоступно", {
                code: "COMPLAINT_TARGET_UNAVAILABLE",
                statusCode: 409,
            });
        }
    }

    const duplicate = await prisma.complaint.findFirst({
        where: {
            reporterId: actor.id,
            targetType,
            targetId,
            status: { in: ["new", "in_review"] },
        },
        select: { id: true },
    });
    if (duplicate) {
        throw new DomainError("Ваша жалоба уже находится на рассмотрении", {
            code: "COMPLAINT_ALREADY_OPEN",
            statusCode: 409,
        });
    }

    return prisma.complaint.create({
        data: {
            reporterId: actor.id,
            targetType,
            targetId,
            targetSnapshot,
            reason,
            details,
            status: "new",
        },
    });
}

export async function reviewComplaint({
    prisma,
    actor,
    complaintId,
    status,
    resolution,
    advertisementAction = "none",
    actionReason,
    now = new Date(),
}) {
    requireRole(actor, ["admin", "moderator"]);
    if (!REVIEW_STATUSES.has(status)) {
        throw new DomainError("Некорректный статус жалобы", {
            code: "INVALID_COMPLAINT_STATUS",
            field: "status",
        });
    }
    const normalizedResolution = ["resolved", "rejected"].includes(status)
        ? normalizeRequiredText(resolution, {
            field: "resolution",
            label: "Результат рассмотрения",
            min: 3,
            max: 2000,
        })
        : normalizeOptionalText(resolution, {
            field: "resolution",
            label: "Комментарий",
            max: 2000,
        });
    const complaint = await prisma.complaint.findUnique({
        where: { id: complaintId },
        select: { id: true, status: true, targetType: true, targetId: true },
    });
    if (!complaint) {
        throw new DomainError("Жалоба не найдена", {
            code: "COMPLAINT_NOT_FOUND",
            statusCode: 404,
        });
    }
    if (["resolved", "rejected"].includes(complaint.status)) {
        throw new DomainError("Жалоба уже рассмотрена", {
            code: "COMPLAINT_ALREADY_CLOSED",
            statusCode: 409,
        });
    }
    const normalizedAction = typeof advertisementAction === "string" ? advertisementAction : "none";
    if (!ADVERTISEMENT_ACTIONS.has(normalizedAction)) {
        throw new DomainError("Некорректное действие с объявлением", {
            code: "INVALID_COMPLAINT_ACTION",
            field: "advertisementAction",
        });
    }
    if (normalizedAction !== "none" && (status !== "resolved" || complaint.targetType !== "advertisement")) {
        throw new DomainError("Это действие нельзя применить к жалобе", {
            code: "COMPLAINT_ACTION_FORBIDDEN",
            statusCode: 409,
        });
    }
    const normalizedActionReason = normalizedAction === "none"
        ? null
        : normalizeRequiredText(actionReason, {
            field: "actionReason",
            label: "Причина решения по объявлению",
            min: 3,
            max: 1000,
        });

    return prisma.$transaction(async (tx) => {
        if (normalizedAction !== "none") {
            const advertisement = await tx.advertisement.findUnique({
                where: { id: complaint.targetId },
                select: { id: true, status: true },
            });
            if (!advertisement || advertisement.status === "deleted") {
                throw new DomainError("Объявление уже удалено", {
                    code: "ADVERTISEMENT_NOT_FOUND",
                    statusCode: 404,
                });
            }
            await tx.advertisement.update({
                where: { id: complaint.targetId },
                data: {
                    status: normalizedAction,
                    moderationReason: normalizedActionReason,
                    moderatedAt: now,
                    moderatedById: actor.id,
                },
            });
            await tx.auditLog.create({
                data: {
                    adminId: actor.id,
                    action: `advertisement.${normalizedAction}`,
                    targetId: complaint.targetId,
                    details: {
                        reason: normalizedActionReason,
                        previousStatus: advertisement.status,
                        complaintId,
                    },
                },
            });
        }
        const updated = await tx.complaint.update({
            where: { id: complaintId },
            data: {
                status,
                assignedToId: actor.id,
                resolution: normalizedResolution,
                resolvedAt: ["resolved", "rejected"].includes(status) ? now : null,
            },
        });
        await tx.auditLog.create({
            data: {
                adminId: actor.id,
                action: `complaint.${status}`,
                targetId: complaintId,
                details: {
                    resolution: normalizedResolution,
                    advertisementAction: normalizedAction,
                    actionReason: normalizedActionReason,
                },
            },
        });
        return updated;
    });
}
