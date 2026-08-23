import { randomUUID } from "node:crypto";

import {
    DomainError,
    normalizeOptionalText,
    normalizeRequiredText,
    requireRole,
} from "../domain/DomainError.js";

const GROUP_MODES = new Set(["readonly", "announcements", "chat"]);
const CONTENT_TYPES = new Set(["chat", "notice", "advertisement"]);
const VISIBILITIES = new Set(["public", "private"]);
const PUBLISH_POLICIES = new Set([
    "members",
    "selected_authors",
    "admin_moderator",
    "owner",
    "admin",
]);
const GROUP_STATUSES = new Set(["active", "disabled", "archived"]);

export const GROUP_TEMPLATES = Object.freeze({
    information: {
        mode: "readonly",
        contentType: "notice",
        visibility: "public",
        publishPolicy: "admin_moderator",
    },
    selected: {
        mode: "readonly",
        contentType: "notice",
        visibility: "public",
        publishPolicy: "selected_authors",
    },
    advertisement: {
        mode: "announcements",
        contentType: "advertisement",
        visibility: "public",
        publishPolicy: "members",
        requiresAnnouncementWithImage: false,
        advertisementLifetimeDays: 7,
    },
    chat: {
        mode: "chat",
        contentType: "chat",
        visibility: "public",
        publishPolicy: "members",
    },
    private: {
        mode: "chat",
        contentType: "chat",
        visibility: "private",
        publishPolicy: "members",
    },
    paid: {
        mode: "announcements",
        contentType: "advertisement",
        visibility: "public",
        publishPolicy: "owner",
        requiresAnnouncementWithImage: false,
    },
    vip: {
        mode: "chat",
        contentType: "chat",
        visibility: "private",
        publishPolicy: "members",
    },
});

function oneOf(value, allowed, field, label) {
    if (!allowed.has(value)) {
        throw new DomainError(`Недопустимое значение поля «${label}»`, {
            code: "VALIDATION_ERROR",
            field,
        });
    }
    return value;
}

function lifetimeDays(value, contentType) {
    if (contentType !== "advertisement") return null;
    if (value == null || value === "") return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
        throw new DomainError("Срок объявления: от 1 до 365 дней", {
            code: "VALIDATION_ERROR",
            field: "advertisementLifetimeDays",
        });
    }
    return parsed;
}

export function isVipGroup(rule = {}) {
    return rule.visibility === "private"
        && rule.publishPolicy === "members"
        && Boolean(rule.ownerId);
}

function compareManagedGroups(left, right) {
    const leftMatch = /^group-(\d+)$/.exec(left.chatId);
    const rightMatch = /^group-(\d+)$/.exec(right.chatId);

    if (leftMatch && rightMatch) return Number(leftMatch[1]) - Number(rightMatch[1]);
    if (leftMatch) return -1;
    if (rightMatch) return 1;

    const createdDifference = new Date(left.chat?.createdAt ?? 0).getTime()
        - new Date(right.chat?.createdAt ?? 0).getTime();
    if (createdDifference !== 0) return createdDifference;
    return String(left.chat?.title ?? left.chatId).localeCompare(
        String(right.chat?.title ?? right.chatId),
        "ru",
    );
}

function assertModeratorMayManage(actor, rule) {
    requireRole(actor, ["admin", "moderator"]);
    if (actor.role === "moderator" && isVipGroup(rule)) {
        throw new DomainError("VIP-группой управляет только администратор", {
            code: "VIP_ADMIN_ONLY",
            statusCode: 403,
        });
    }
}

function auditData(actorId, action, targetId, details) {
    return { adminId: actorId, action, targetId, details };
}

function normalizeSettings(source = {}) {
    const mode = oneOf(source.mode, GROUP_MODES, "mode", "режим");
    const contentType = oneOf(source.contentType, CONTENT_TYPES, "contentType", "тип содержимого");
    const visibility = oneOf(source.visibility, VISIBILITIES, "visibility", "видимость");
    const publishPolicy = oneOf(source.publishPolicy, PUBLISH_POLICIES, "publishPolicy", "кто публикует");

    if (publishPolicy === "owner" && visibility !== "public") {
        throw new DomainError("Группа владельца должна быть доступна для просмотра всем", {
            code: "INVALID_GROUP_POLICY",
            field: "visibility",
        });
    }
    if (contentType === "advertisement" && mode !== "announcements") {
        throw new DomainError("Объявления требуют режима публикаций", {
            code: "INVALID_GROUP_POLICY",
            field: "mode",
        });
    }

    return {
        mode,
        contentType,
        visibility,
        publishPolicy,
        requiresAnnouncementWithImage: false,
        advertisementLifetimeDays: lifetimeDays(source.advertisementLifetimeDays, contentType),
    };
}

function groupInclude() {
    const profile = { id: true, name: true, phone: true, avatar: true, role: true, status: true };
    return {
        chat: { select: { id: true, title: true, createdAt: true } },
        owner: { select: profile },
        publishers: {
            include: { user: { select: profile } },
            orderBy: { assignedAt: "asc" },
        },
    };
}

export function toManagedGroup(rule, members = []) {
    return {
        chatId: rule.chatId,
        title: rule.chat?.title || rule.chatId,
        createdAt: rule.chat?.createdAt ?? null,
        mode: rule.mode,
        contentType: rule.contentType,
        visibility: rule.visibility,
        publishPolicy: rule.publishPolicy,
        status: rule.status,
        requiresAnnouncementWithImage: rule.requiresAnnouncementWithImage,
        advertisementLifetimeDays: rule.advertisementLifetimeDays,
        owner: rule.owner,
        ownershipStartsAt: rule.ownershipStartsAt,
        ownershipEndsAt: rule.ownershipEndsAt,
        isVip: isVipGroup(rule),
        publishers: (rule.publishers ?? []).map((item) => ({
            assignedAt: item.assignedAt,
            user: item.user,
        })),
        members,
    };
}

export async function listManagedGroups({ prisma, actor }) {
    requireRole(actor, ["admin", "moderator"]);
    const rules = await prisma.groupRule.findMany({
        include: groupInclude(),
        orderBy: { chatId: "asc" },
    });
    const visibleRules = actor.role === "admin"
        ? rules
        : rules.filter((rule) => !isVipGroup(rule));
    visibleRules.sort(compareManagedGroups);
    const privateIds = visibleRules
        .filter((rule) => rule.visibility === "private")
        .map((rule) => rule.chatId);
    const memberships = privateIds.length === 0 ? [] : await prisma.chatMember.findMany({
        where: { chatId: { in: privateIds } },
        include: {
            user: {
                select: { id: true, name: true, phone: true, avatar: true, role: true, status: true },
            },
        },
        orderBy: { joinedAt: "asc" },
    });
    const membersByChat = new Map();
    for (const membership of memberships) {
        const list = membersByChat.get(membership.chatId) ?? [];
        list.push({ role: membership.role, joinedAt: membership.joinedAt, user: membership.user });
        membersByChat.set(membership.chatId, list);
    }
    return visibleRules.map((rule) => toManagedGroup(rule, membersByChat.get(rule.chatId) ?? []));
}

export async function listGroupCandidates({ prisma, actor }) {
    requireRole(actor, ["admin", "moderator"]);
    return prisma.user.findMany({
        where: { status: "active" },
        select: { id: true, name: true, phone: true, avatar: true, role: true, status: true },
        orderBy: { name: "asc" },
        take: 1000,
    });
}

export async function createManagedGroup({ prisma, actor, source, now = new Date() }) {
    requireRole(actor, ["admin"]);
    const title = normalizeRequiredText(source?.title, {
        field: "title",
        label: "Название группы",
        min: 2,
        max: 80,
    });
    const templateName = typeof source?.template === "string" ? source.template : "";
    const template = GROUP_TEMPLATES[templateName];
    if (!template) {
        throw new DomainError("Выберите тип группы", {
            code: "VALIDATION_ERROR",
            field: "template",
        });
    }
    const chatId = `group-${randomUUID()}`;
    const settings = normalizeSettings(template);
    const ownerId = templateName === "vip" ? actor.id : null;

    return prisma.$transaction(async (tx) => {
        await tx.chat.create({ data: { id: chatId, type: "group", title, createdAt: now } });
        const rule = await tx.groupRule.create({
            data: { chatId, ...settings, ownerId },
            include: groupInclude(),
        });
        if (templateName === "vip") {
            await tx.chatMember.create({ data: { chatId, userId: actor.id, role: "owner" } });
        }
        await tx.auditLog.create({
            data: auditData(actor.id, "group.create", chatId, { title, template: templateName }),
        });
        return toManagedGroup(rule, templateName === "vip" ? [{
            role: "owner",
            joinedAt: now,
            user: {
                id: actor.id,
                name: actor.name,
                phone: actor.phone,
                avatar: actor.avatar,
                role: actor.role,
                status: actor.status,
            },
        }] : []);
    });
}

export async function updateManagedGroup({ prisma, actor, chatId, source }) {
    requireRole(actor, ["admin"]);
    const current = await prisma.groupRule.findUnique({
        where: { chatId },
        include: { chat: { select: { title: true } } },
    });
    if (!current) {
        throw new DomainError("Группа не найдена", { code: "GROUP_NOT_FOUND", statusCode: 404 });
    }
    if (isVipGroup(current)) {
        throw new DomainError("Тип VIP-группы нельзя менять", {
            code: "VIP_POLICY_LOCKED",
            statusCode: 409,
        });
    }
    const title = normalizeRequiredText(source?.title, {
        field: "title",
        label: "Название группы",
        min: 2,
        max: 80,
    });
    const settings = normalizeSettings(source);

    return prisma.$transaction(async (tx) => {
        await tx.chat.update({ where: { id: chatId }, data: { title } });
        await tx.groupRule.update({
            where: { chatId },
            data: {
                ...settings,
                ...(settings.publishPolicy === "owner" ? {} : {
                    ownerId: null,
                    ownershipStartsAt: null,
                    ownershipEndsAt: null,
                }),
            },
        });
        await tx.auditLog.create({
            data: auditData(actor.id, "group.settings", chatId, {
                previousTitle: current.chat?.title,
                title,
                ...settings,
            }),
        });
        const updated = await tx.groupRule.findUnique({ where: { chatId }, include: groupInclude() });
        return toManagedGroup(updated);
    });
}

export async function changeGroupStatus({ prisma, actor, chatId, status, reason }) {
    const normalizedStatus = oneOf(status, GROUP_STATUSES, "status", "статус");
    const current = await prisma.groupRule.findUnique({ where: { chatId } });
    if (!current) {
        throw new DomainError("Группа не найдена", { code: "GROUP_NOT_FOUND", statusCode: 404 });
    }
    assertModeratorMayManage(actor, current);
    const normalizedReason = normalizedStatus === "active" ? null : normalizeRequiredText(reason, {
        field: "reason",
        label: "Причина отключения",
        min: 3,
        max: 500,
    });
    const updated = await prisma.$transaction(async (tx) => {
        const rule = await tx.groupRule.update({ where: { chatId }, data: { status: normalizedStatus } });
        await tx.auditLog.create({
            data: auditData(actor.id, "group.status", chatId, {
                previousStatus: current.status,
                status: normalizedStatus,
                reason: normalizedReason,
            }),
        });
        return rule;
    });
    return { chatId: updated.chatId, status: updated.status };
}

async function loadAssignmentContext(prisma, chatId, userId) {
    const [rule, user] = await Promise.all([
        prisma.groupRule.findUnique({ where: { chatId } }),
        prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true, status: true },
        }),
    ]);
    if (!rule) throw new DomainError("Группа не найдена", { code: "GROUP_NOT_FOUND", statusCode: 404 });
    if (!user || user.status !== "active") {
        throw new DomainError("Можно назначить только активного пользователя", {
            code: "USER_NOT_ACTIVE",
            statusCode: 409,
        });
    }
    return { rule, user };
}

export async function setGroupMember({ prisma, actor, chatId, userId, assigned }) {
    const { rule, user } = await loadAssignmentContext(prisma, chatId, userId);
    assertModeratorMayManage(actor, rule);
    if (rule.visibility !== "private") {
        throw new DomainError("Участники назначаются только закрытым группам", {
            code: "GROUP_NOT_PRIVATE",
            statusCode: 409,
        });
    }
    if (!assigned && user.role === "admin") {
        throw new DomainError("Администратора нельзя исключить из закрытой группы", {
            code: "ADMIN_MEMBERSHIP_PROTECTED",
            statusCode: 409,
        });
    }
    await prisma.$transaction(async (tx) => {
        if (assigned) {
            await tx.chatMember.upsert({
                where: { chatId_userId: { chatId, userId } },
                create: { chatId, userId },
                update: {},
            });
        } else {
            await tx.chatMember.deleteMany({ where: { chatId, userId } });
        }
        await tx.auditLog.create({
            data: auditData(actor.id, assigned ? "group.member.add" : "group.member.remove", chatId, { userId }),
        });
    });
}

export async function setGroupPublisher({ prisma, actor, chatId, userId, assigned }) {
    const { rule } = await loadAssignmentContext(prisma, chatId, userId);
    assertModeratorMayManage(actor, rule);
    if (rule.publishPolicy !== "selected_authors") {
        throw new DomainError("Авторы назначаются только группе с выбранными авторами", {
            code: "GROUP_NOT_SELECTED_AUTHORS",
            statusCode: 409,
        });
    }
    await prisma.$transaction(async (tx) => {
        if (assigned) {
            await tx.groupPublisher.upsert({
                where: { chatId_userId: { chatId, userId } },
                create: { chatId, userId },
                update: {},
            });
        } else {
            await tx.groupPublisher.deleteMany({ where: { chatId, userId } });
        }
        await tx.auditLog.create({
            data: auditData(actor.id, assigned ? "group.publisher.add" : "group.publisher.remove", chatId, { userId }),
        });
    });
}

export async function setGroupOwner({ prisma, actor, chatId, source }) {
    requireRole(actor, ["admin"]);
    const userId = normalizeRequiredText(source?.userId, {
        field: "userId",
        label: "Владелец",
        min: 1,
        max: 100,
    });
    const { rule } = await loadAssignmentContext(prisma, chatId, userId);
    if (rule.publishPolicy !== "owner" || rule.visibility !== "public") {
        throw new DomainError("Владелец назначается только публичной группе владельца", {
            code: "GROUP_NOT_OWNER_MANAGED",
            statusCode: 409,
        });
    }
    const startsAt = new Date(source?.ownershipStartsAt);
    const endsAt = new Date(source?.ownershipEndsAt);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
        throw new DomainError("Укажите корректный период владения группой", {
            code: "INVALID_OWNERSHIP_PERIOD",
            field: "ownershipEndsAt",
        });
    }
    return prisma.$transaction(async (tx) => {
        const updated = await tx.groupRule.update({
            where: { chatId },
            data: { ownerId: userId, ownershipStartsAt: startsAt, ownershipEndsAt: endsAt },
        });
        await tx.auditLog.create({
            data: auditData(actor.id, "group.owner.set", chatId, {
                userId,
                ownershipStartsAt: startsAt.toISOString(),
                ownershipEndsAt: endsAt.toISOString(),
            }),
        });
        return updated;
    });
}

export async function clearGroupOwner({ prisma, actor, chatId, reason }) {
    requireRole(actor, ["admin"]);
    const normalizedReason = normalizeOptionalText(reason, {
        field: "reason",
        label: "Причина снятия владельца",
        max: 500,
    });
    const current = await prisma.groupRule.findUnique({ where: { chatId } });
    if (!current) throw new DomainError("Группа не найдена", { code: "GROUP_NOT_FOUND", statusCode: 404 });
    if (current.publishPolicy !== "owner") {
        throw new DomainError("У этой группы нет договорного владельца", {
            code: "GROUP_NOT_OWNER_MANAGED",
            statusCode: 409,
        });
    }
    return prisma.$transaction(async (tx) => {
        const updated = await tx.groupRule.update({
            where: { chatId },
            data: { ownerId: null, ownershipStartsAt: null, ownershipEndsAt: null },
        });
        await tx.auditLog.create({
            data: auditData(actor.id, "group.owner.clear", chatId, {
                previousOwnerId: current.ownerId,
                reason: normalizedReason,
            }),
        });
        return updated;
    });
}
