import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/password.js";
import { readAdminBootstrapConfig } from "../src/admin/bootstrapConfig.js";

const prisma = new PrismaClient();

async function main() {
    const config = readAdminBootstrapConfig();
    const user = await prisma.user.findUnique({ where: { id: config.userId } });
    if (!user) throw new Error(`User ${config.userId} was not found; bootstrap never creates a duplicate account`);

    const conflict = await prisma.user.findFirst({
        where: {
            id: { not: config.userId },
            OR: [{ login: config.login }, { email: config.email }],
        },
        select: { id: true, login: true, email: true },
    });
    if (conflict) throw new Error("ADMIN_LOGIN or ADMIN_EMAIL is already assigned to another user");

    const passwordHash = await hashPassword(config.password);
    const admin = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
            where: { id: config.userId },
            data: {
                login: config.login,
                email: config.email,
                passwordHash,
                status: "active",
                role: "admin",
                approvalCode: null,
            },
        });

        await tx.session.deleteMany({ where: { userId: config.userId } });
        await tx.auditLog.create({
            data: {
                adminId: config.userId,
                action: "admin.bootstrap",
                targetId: config.userId,
                details: { source: "bootstrap-admin" },
            },
        });

        return updated;
    });

    console.log(`Admin account is ready: ${admin.login}`);
}

main()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
