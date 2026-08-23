import { DomainError } from "../domain/DomainError.js";

const BLOCKED_USER_SELECT = {
    id: true,
    name: true,
    phone: true,
    avatar: true,
};

export async function listBlockedUsers(db, blockerId) {
    const rows = await db.userBlock.findMany({
        where: { blockerId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, blocked: { select: BLOCKED_USER_SELECT } },
    });
    return rows.map(({ blocked, createdAt }) => ({ ...blocked, blockedAt: createdAt }));
}

export async function blockUser(db, blockerId, blockedId) {
    if (!blockedId || blockedId === blockerId) {
        throw new DomainError("Нельзя заблокировать самого себя", { code: "INVALID_BLOCK_TARGET" });
    }
    const target = await db.user.findFirst({
        where: { id: blockedId, status: { not: "deleted" } },
        select: BLOCKED_USER_SELECT,
    });
    if (!target) throw new DomainError("Пользователь не найден", { code: "USER_NOT_FOUND", statusCode: 404 });
    const row = await db.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        create: { blockerId, blockedId },
        update: {},
        select: { createdAt: true },
    });
    return { ...target, blockedAt: row.createdAt };
}

export async function unblockUser(db, blockerId, blockedId) {
    await db.userBlock.deleteMany({ where: { blockerId, blockedId } });
}

export async function isPrivateContactUnavailable(db, firstUserId, secondUserId) {
    if (!firstUserId || !secondUserId || firstUserId === secondUserId) return false;
    const row = await db.userBlock.findFirst({
        where: {
            OR: [
                { blockerId: firstUserId, blockedId: secondUserId },
                { blockerId: secondUserId, blockedId: firstUserId },
            ],
        },
        select: { blockerId: true },
    });
    return Boolean(row);
}
