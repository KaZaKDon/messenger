import { DomainError, requireActiveActor } from "../domain/DomainError.js";
import { expireAdvertisements } from "./advertisementService.js";

const visibleAdvertisementGroupWhere = {
    status: "active",
    visibility: "public",
    contentType: "advertisement",
};

export async function getAdvertisementGroupSummaries({ prisma, actor, now = new Date() }) {
    requireActiveActor(actor);
    await expireAdvertisements({ prisma, now });

    const groups = await prisma.groupRule.findMany({
        where: visibleAdvertisementGroupWhere,
        select: {
            chatId: true,
            advertisements: {
                where: { status: "active" },
                select: { authorId: true, title: true, publishedAt: true },
                orderBy: { publishedAt: "desc" },
            },
        },
        orderBy: { chatId: "asc" },
    });
    const chatIds = groups.map((group) => group.chatId);
    const reads = chatIds.length
        ? await prisma.advertisementGroupRead.findMany({
            where: { userId: actor.id, chatId: { in: chatIds } },
            select: { chatId: true, lastReadAt: true },
        })
        : [];
    const readByChatId = new Map(reads.map((read) => [read.chatId, read.lastReadAt]));

    return groups.map((group) => {
        const lastReadAt = readByChatId.get(group.chatId) ?? null;
        const latest = group.advertisements[0] ?? null;
        const unread = group.advertisements.filter((advertisement) => (
            advertisement.authorId !== actor.id
            && (!lastReadAt || advertisement.publishedAt > lastReadAt)
        )).length;

        return {
            chatId: group.chatId,
            total: group.advertisements.length,
            unread,
            latestTitle: latest?.title ?? null,
            latestPublishedAt: latest?.publishedAt ?? null,
        };
    });
}

export async function markAdvertisementGroupRead({ prisma, actor, chatId, now = new Date() }) {
    requireActiveActor(actor);
    const normalizedChatId = typeof chatId === "string" ? chatId.trim() : "";
    const group = normalizedChatId
        ? await prisma.groupRule.findFirst({
            where: { chatId: normalizedChatId, ...visibleAdvertisementGroupWhere },
            select: { chatId: true },
        })
        : null;
    if (!group) {
        throw new DomainError("Группа объявлений недоступна", {
            code: "ADVERTISEMENT_GROUP_UNAVAILABLE",
            statusCode: 404,
        });
    }

    return prisma.advertisementGroupRead.upsert({
        where: { userId_chatId: { userId: actor.id, chatId: normalizedChatId } },
        create: { userId: actor.id, chatId: normalizedChatId, lastReadAt: now },
        update: { lastReadAt: now },
    });
}
