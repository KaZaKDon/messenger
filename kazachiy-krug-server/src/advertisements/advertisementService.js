import { canPublishToGroup } from "../groups/groupAccessPolicy.js";
import {
    DomainError,
    normalizeRequiredText,
    requireActiveActor,
    requireRole,
} from "../domain/DomainError.js";
import {
    advertisementExpiry,
    MAX_ACTIVE_ADVERTISEMENTS,
    validateAdvertisementInput,
} from "./advertisementValidation.js";
import { assertActiveSettlement } from "../settlements/settlementService.js";

const OPEN_SLOT_STATUSES = ["active", "needs_edit"];
const MODERATION_STATUSES = new Set(["active", "needs_edit", "removed"]);

async function loadPublishingContext({ prisma, chatId, actorId }) {
    const [rule, membership] = await Promise.all([
        prisma.groupRule.findUnique({
            where: { chatId },
            include: { publishers: { select: { userId: true } } },
        }),
        prisma.chatMember.findUnique({
            where: { chatId_userId: { chatId, userId: actorId } },
            select: { userId: true },
        }),
    ]);
    return { rule, isMember: Boolean(membership) };
}

function assertAdvertisementGroup(rule) {
    if (!rule || rule.status !== "active") {
        throw new DomainError("Группа недоступна", {
            code: "GROUP_UNAVAILABLE",
            statusCode: 404,
        });
    }
    if (rule.contentType !== "advertisement") {
        throw new DomainError("В этой группе размещаются не объявления", {
            code: "WRONG_GROUP_CONTENT_TYPE",
            statusCode: 409,
        });
    }
}

async function assertAvailableSlot({ prisma, actorId, rule, now }) {
    if (rule.publishPolicy !== "members") return;
    const count = await prisma.advertisement.count({
        where: {
            authorId: actorId,
            status: { in: OPEN_SLOT_STATUSES },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
    });
    if (count >= MAX_ACTIVE_ADVERTISEMENTS) {
        throw new DomainError("У вас уже 5 активных объявлений", {
            code: "ADVERTISEMENT_LIMIT_REACHED",
            statusCode: 409,
        });
    }
}

export async function createAdvertisement({
    prisma,
    actor,
    chatId,
    source,
    now = new Date(),
}) {
    requireActiveActor(actor);
    const { rule, isMember } = await loadPublishingContext({
        prisma,
        chatId,
        actorId: actor.id,
    });
    assertAdvertisementGroup(rule);
    if (!canPublishToGroup({ rule, user: actor, isMember, now })) {
        throw new DomainError("В этой группе у вас нет права публикации", {
            code: "PUBLISH_FORBIDDEN",
            statusCode: 403,
        });
    }

    const input = validateAdvertisementInput(source, { imageRequired: false });
    const settlement = await assertActiveSettlement({ prisma, name: input.settlement });
    await assertAvailableSlot({ prisma, actorId: actor.id, rule, now });

    return prisma.advertisement.create({
        data: {
            chatId,
            authorId: actor.id,
            title: input.title,
            settlement: settlement.name,
            price: input.price,
            description: input.description,
            status: "active",
            publishedAt: now,
            expiresAt: advertisementExpiry({
                now,
                lifetimeDays: rule.advertisementLifetimeDays,
            }),
            images: { create: input.images },
        },
        include: { images: { orderBy: { sortOrder: "asc" } } },
    });
}

export async function editAdvertisement({ prisma, actor, advertisementId, source }) {
    requireActiveActor(actor);
    const advertisement = await prisma.advertisement.findUnique({
        where: { id: advertisementId },
        include: { groupRule: true },
    });
    if (!advertisement || advertisement.status === "deleted") {
        throw new DomainError("Объявление не найдено", {
            code: "ADVERTISEMENT_NOT_FOUND",
            statusCode: 404,
        });
    }
    if (advertisement.authorId !== actor.id) {
        throw new DomainError("Редактировать объявление может только его автор", {
            code: "EDIT_FORBIDDEN",
            statusCode: 403,
        });
    }
    if (!["active", "needs_edit"].includes(advertisement.status)) {
        throw new DomainError("Это объявление сейчас нельзя редактировать", {
            code: "ADVERTISEMENT_NOT_EDITABLE",
            statusCode: 409,
        });
    }
    const input = validateAdvertisementInput(source, { imageRequired: false });
    const settlement = await assertActiveSettlement({ prisma, name: input.settlement });

    return prisma.$transaction(async (tx) => {
        await tx.advertisementImage.deleteMany({ where: { advertisementId } });
        return tx.advertisement.update({
            where: { id: advertisementId },
            data: {
                title: input.title,
                settlement: settlement.name,
                price: input.price,
                description: input.description,
                status: "active",
                moderationReason: null,
                moderatedAt: null,
                moderatedById: null,
                images: { create: input.images },
            },
            include: { images: { orderBy: { sortOrder: "asc" } } },
        });
    });
}

export async function extendAdvertisement({
    prisma,
    actor,
    advertisementId,
    now = new Date(),
}) {
    requireActiveActor(actor);
    const advertisement = await prisma.advertisement.findUnique({
        where: { id: advertisementId },
        include: { groupRule: true },
    });
    if (!advertisement || advertisement.status === "deleted") {
        throw new DomainError("Объявление не найдено", {
            code: "ADVERTISEMENT_NOT_FOUND",
            statusCode: 404,
        });
    }
    if (advertisement.authorId !== actor.id) {
        throw new DomainError("Продлить объявление может только его автор", {
            code: "EXTEND_FORBIDDEN",
            statusCode: 403,
        });
    }
    if (!["active", "expired"].includes(advertisement.status)) {
        throw new DomainError("Сначала устраните замечание модерации", {
            code: "ADVERTISEMENT_NOT_EXTENDABLE",
            statusCode: 409,
        });
    }
    const lifetimeDays = advertisement.groupRule.advertisementLifetimeDays;
    if (lifetimeDays == null) {
        throw new DomainError("Для этой группы срок публикации назначает администратор", {
            code: "MANUAL_EXPIRY_ONLY",
            statusCode: 409,
        });
    }
    const currentExpiry = advertisement.expiresAt?.getTime?.() ?? 0;
    const extensionStart = new Date(Math.max(now.getTime(), currentExpiry));

    return prisma.advertisement.update({
        where: { id: advertisementId },
        data: {
            status: "active",
            expiresAt: advertisementExpiry({ now: extensionStart, lifetimeDays }),
        },
    });
}

export async function deleteOwnAdvertisement({ prisma, actor, advertisementId }) {
    requireActiveActor(actor);
    const advertisement = await prisma.advertisement.findUnique({
        where: { id: advertisementId },
        select: { id: true, authorId: true, status: true },
    });
    if (!advertisement || advertisement.status === "deleted") {
        throw new DomainError("Объявление не найдено", {
            code: "ADVERTISEMENT_NOT_FOUND",
            statusCode: 404,
        });
    }
    if (advertisement.authorId !== actor.id) {
        throw new DomainError("Удалить объявление может только его автор", {
            code: "DELETE_FORBIDDEN",
            statusCode: 403,
        });
    }
    return prisma.advertisement.update({
        where: { id: advertisementId },
        data: { status: "deleted" },
    });
}

export async function moderateAdvertisement({
    prisma,
    actor,
    advertisementId,
    status,
    reason,
    now = new Date(),
}) {
    requireRole(actor, ["admin", "moderator"]);
    if (!MODERATION_STATUSES.has(status)) {
        throw new DomainError("Некорректный результат модерации", {
            code: "INVALID_MODERATION_STATUS",
            field: "status",
        });
    }
    const normalizedReason = status === "active"
        ? null
        : normalizeRequiredText(reason, {
            field: "reason",
            label: "Причина решения",
            min: 3,
            max: 1000,
        });

    const advertisement = await prisma.advertisement.findUnique({
        where: { id: advertisementId },
        select: { id: true, status: true },
    });
    if (!advertisement || advertisement.status === "deleted") {
        throw new DomainError("Объявление не найдено", {
            code: "ADVERTISEMENT_NOT_FOUND",
            statusCode: 404,
        });
    }

    return prisma.$transaction(async (tx) => {
        const updated = await tx.advertisement.update({
            where: { id: advertisementId },
            data: {
                status,
                moderationReason: normalizedReason,
                moderatedAt: now,
                moderatedById: actor.id,
            },
        });
        await tx.auditLog.create({
            data: {
                adminId: actor.id,
                action: `advertisement.${status}`,
                targetId: advertisementId,
                details: { reason: normalizedReason, previousStatus: advertisement.status },
            },
        });
        return updated;
    });
}

export async function expireAdvertisements({ prisma, now = new Date() }) {
    return prisma.advertisement.updateMany({
        where: { status: "active", expiresAt: { lte: now } },
        data: { status: "expired" },
    });
}
