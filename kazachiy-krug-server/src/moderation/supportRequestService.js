import {
    DomainError,
    normalizeRequiredText,
    requireActiveActor,
    requireRole,
} from "../domain/DomainError.js";

const SUPPORT_CATEGORIES = new Set(["question", "suggestion", "technical", "violation", "other"]);

export async function createSupportRequest({ prisma, actor, source, now = new Date() }) {
    requireActiveActor(actor);
    const category = typeof source?.category === "string" ? source.category : "";
    if (!SUPPORT_CATEGORIES.has(category)) {
        throw new DomainError("Выберите категорию обращения", {
            code: "INVALID_SUPPORT_CATEGORY",
            field: "category",
        });
    }
    const subject = normalizeRequiredText(source?.subject, {
        field: "subject",
        label: "Тема обращения",
        min: 3,
        max: 160,
    });
    const text = normalizeRequiredText(source?.text, {
        field: "text",
        label: "Текст обращения",
        min: 5,
        max: 5000,
    });

    return prisma.supportRequest.create({
        data: {
            authorId: actor.id,
            subject,
            category,
            status: "new",
            authorLastReadAt: now,
            messages: { create: { authorId: actor.id, text } },
        },
        include: { messages: { orderBy: { createdAt: "asc" } } },
    });
}

export async function answerSupportRequest({
    prisma,
    actor,
    requestId,
    text,
    now = new Date(),
}) {
    requireRole(actor, ["admin", "moderator"]);
    const normalizedText = normalizeRequiredText(text, {
        field: "text",
        label: "Ответ",
        min: 2,
        max: 5000,
    });
    const request = await prisma.supportRequest.findUnique({
        where: { id: requestId },
        select: { id: true, status: true },
    });
    if (!request) {
        throw new DomainError("Обращение не найдено", {
            code: "SUPPORT_REQUEST_NOT_FOUND",
            statusCode: 404,
        });
    }
    if (request.status === "closed") {
        throw new DomainError("Обращение уже закрыто", {
            code: "SUPPORT_REQUEST_CLOSED",
            statusCode: 409,
        });
    }

    return prisma.$transaction(async (tx) => {
        await tx.supportRequestMessage.create({
            data: { requestId, authorId: actor.id, text: normalizedText },
        });
        const updated = await tx.supportRequest.update({
            where: { id: requestId },
            data: {
                status: "answered",
                assignedToId: actor.id,
                lastStaffMessageAt: now,
            },
            include: { messages: { orderBy: { createdAt: "asc" } } },
        });
        await tx.auditLog.create({
            data: {
                adminId: actor.id,
                action: "support_request.answer",
                targetId: requestId,
                details: null,
            },
        });
        return updated;
    });
}

export async function startSupportRequest({ prisma, actor, requestId }) {
    requireRole(actor, ["admin", "moderator"]);
    const request = await prisma.supportRequest.findUnique({
        where: { id: requestId },
        select: { id: true, status: true },
    });
    if (!request) {
        throw new DomainError("Обращение не найдено", {
            code: "SUPPORT_REQUEST_NOT_FOUND",
            statusCode: 404,
        });
    }
    if (request.status === "closed") {
        throw new DomainError("Обращение уже закрыто", {
            code: "SUPPORT_REQUEST_CLOSED",
            statusCode: 409,
        });
    }
    return prisma.$transaction(async (tx) => {
        const updated = await tx.supportRequest.update({
            where: { id: requestId },
            data: { status: "in_progress", assignedToId: actor.id },
        });
        await tx.auditLog.create({
            data: {
                adminId: actor.id,
                action: "support_request.start",
                targetId: requestId,
                details: { previousStatus: request.status },
            },
        });
        return updated;
    });
}

export async function addSupportRequestMessage({ prisma, actor, requestId, text }) {
    requireActiveActor(actor);
    const normalizedText = normalizeRequiredText(text, {
        field: "text",
        label: "Сообщение",
        min: 2,
        max: 5000,
    });
    const request = await prisma.supportRequest.findUnique({
        where: { id: requestId },
        select: { id: true, authorId: true, status: true },
    });
    if (!request || request.authorId !== actor.id) {
        throw new DomainError("Обращение не найдено", {
            code: "SUPPORT_REQUEST_NOT_FOUND",
            statusCode: 404,
        });
    }
    if (request.status === "closed") {
        throw new DomainError("Обращение уже закрыто", {
            code: "SUPPORT_REQUEST_CLOSED",
            statusCode: 409,
        });
    }

    return prisma.$transaction(async (tx) => {
        const message = await tx.supportRequestMessage.create({
            data: { requestId, authorId: actor.id, text: normalizedText },
        });
        await tx.supportRequest.update({
            where: { id: requestId },
            data: { status: "in_progress" },
        });
        return message;
    });
}

export async function closeSupportRequest({ prisma, actor, requestId, now = new Date() }) {
    requireActiveActor(actor);
    const request = await prisma.supportRequest.findUnique({
        where: { id: requestId },
        select: { id: true, authorId: true, status: true },
    });
    const canClose = request && (
        request.authorId === actor.id || ["admin", "moderator"].includes(actor.role)
    );
    if (!canClose) {
        throw new DomainError("Обращение не найдено", {
            code: "SUPPORT_REQUEST_NOT_FOUND",
            statusCode: 404,
        });
    }
    if (request.status === "closed") return request;

    return prisma.supportRequest.update({
        where: { id: requestId },
        data: { status: "closed", closedAt: now },
    });
}

export async function markSupportRequestRead({ prisma, actor, requestId, now = new Date() }) {
    requireActiveActor(actor);
    const request = await prisma.supportRequest.findUnique({
        where: { id: requestId },
        select: { id: true, authorId: true },
    });
    if (!request || request.authorId !== actor.id) {
        throw new DomainError("Обращение не найдено", {
            code: "SUPPORT_REQUEST_NOT_FOUND",
            statusCode: 404,
        });
    }
    return prisma.supportRequest.update({
        where: { id: requestId },
        data: { authorLastReadAt: now },
    });
}
