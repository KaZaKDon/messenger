export const CLEANUP_CONFIRMATION = "DELETE_ALL_EXCEPT_ADMIN";

function readConfirmation(args) {
    const prefix = "--confirm=";
    return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

export function readCleanupLegacyUsersConfig(source = process.env, args = process.argv.slice(2)) {
    const keepUserId = source.ADMIN_USER_ID?.trim();
    if (!keepUserId) {
        throw new Error("ADMIN_USER_ID is required; cleanup must explicitly preserve an administrator");
    }

    if (readConfirmation(args) !== CLEANUP_CONFIRMATION) {
        throw new Error(`Cleanup was not confirmed; add --confirm=${CLEANUP_CONFIRMATION}`);
    }

    return { keepUserId };
}

export function buildLegacyUserCleanupPlan(users, keepUserId) {
    const keepUser = users.find((user) => user.id === keepUserId);
    if (!keepUser) {
        throw new Error(`Protected user ${keepUserId} was not found`);
    }
    if (keepUser.role !== "admin" || keepUser.status !== "active") {
        throw new Error(`Protected user ${keepUserId} must be an active administrator`);
    }

    return {
        keepUser,
        usersToDelete: users.filter((user) => user.id !== keepUserId),
    };
}

function emptySummary() {
    return {
        users: 0,
        privateChats: 0,
        messages: 0,
        calls: 0,
        memberships: 0,
        sessions: 0,
        recoveryRequests: 0,
        settings: 0,
        publisherAssignments: 0,
        ownedGroupsReleased: 0,
        auditLogs: 0,
    };
}

export async function cleanupLegacyUsers({ prisma, keepUserId }) {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            login: true,
            email: true,
            phone: true,
            name: true,
            role: true,
            status: true,
        },
        orderBy: { createdAt: "asc" },
    });
    const plan = buildLegacyUserCleanupPlan(users, keepUserId);
    const targetIds = plan.usersToDelete.map((user) => user.id);

    if (targetIds.length === 0) {
        return { keptUser: plan.keepUser, deletedUsers: [], deleted: emptySummary() };
    }

    const deleted = await prisma.$transaction(async (tx) => {
        const privateChats = await tx.chat.findMany({
            where: {
                type: "private",
                members: { some: { userId: { in: targetIds } } },
            },
            select: { id: true },
        });
        const privateChatIds = privateChats.map((chat) => chat.id);
        const chatOrSenderFilter = [
            { senderId: { in: targetIds } },
            ...(privateChatIds.length > 0 ? [{ chatId: { in: privateChatIds } }] : []),
        ];
        const chatOrInitiatorFilter = [
            { initiatorId: { in: targetIds } },
            ...(privateChatIds.length > 0 ? [{ chatId: { in: privateChatIds } }] : []),
        ];
        const auditTargetIds = [...targetIds, ...privateChatIds];

        const summary = {
            users: targetIds.length,
            privateChats: privateChatIds.length,
            messages: await tx.message.count({ where: { OR: chatOrSenderFilter } }),
            calls: await tx.callSession.count({ where: { OR: chatOrInitiatorFilter } }),
            memberships: await tx.chatMember.count({ where: { userId: { in: targetIds } } }),
            sessions: await tx.session.count({ where: { userId: { in: targetIds } } }),
            recoveryRequests: await tx.passwordRecoveryRequest.count({ where: { userId: { in: targetIds } } }),
            settings: await tx.userSettings.count({ where: { userId: { in: targetIds } } }),
            publisherAssignments: await tx.groupPublisher.count({ where: { userId: { in: targetIds } } }),
            ownedGroupsReleased: await tx.groupRule.count({ where: { ownerId: { in: targetIds } } }),
            auditLogs: await tx.auditLog.count({
                where: {
                    OR: [
                        { adminId: { in: targetIds } },
                        { targetId: { in: auditTargetIds } },
                    ],
                },
            }),
        };

        if (privateChatIds.length > 0) {
            await tx.chat.deleteMany({ where: { id: { in: privateChatIds } } });
        }
        await tx.callSession.deleteMany({ where: { initiatorId: { in: targetIds } } });
        await tx.message.deleteMany({ where: { senderId: { in: targetIds } } });
        await tx.auditLog.deleteMany({
            where: {
                OR: [
                    { adminId: { in: targetIds } },
                    { targetId: { in: auditTargetIds } },
                ],
            },
        });

        const result = await tx.user.deleteMany({ where: { id: { in: targetIds } } });
        if (result.count !== targetIds.length) {
            throw new Error(`Expected to delete ${targetIds.length} users, deleted ${result.count}`);
        }

        return summary;
    });

    return {
        keptUser: plan.keepUser,
        deletedUsers: plan.usersToDelete,
        deleted,
    };
}
