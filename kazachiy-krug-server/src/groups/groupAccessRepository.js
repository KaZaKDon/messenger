export const GROUP_RULE_ACCESS_SELECT = Object.freeze({
    mode: true,
    visibility: true,
    publishPolicy: true,
    status: true,
    contentType: true,
    advertisementLifetimeDays: true,
    requiresAnnouncementWithImage: true,
    publishUserIds: true,
    ownerId: true,
    ownershipStartsAt: true,
    ownershipEndsAt: true,
    publishers: {
        select: {
            userId: true,
        },
    },
});

export function findGroupRuleForAccess(prisma, chatId) {
    return prisma.groupRule.findUnique({
        where: { chatId },
        select: GROUP_RULE_ACCESS_SELECT,
    });
}
