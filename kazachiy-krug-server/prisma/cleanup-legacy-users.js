import { PrismaClient } from "@prisma/client";
import {
    cleanupLegacyUsers,
    readCleanupLegacyUsersConfig,
} from "../src/maintenance/cleanupLegacyUsers.js";

const prisma = new PrismaClient();

async function main() {
    const config = readCleanupLegacyUsersConfig();
    const result = await cleanupLegacyUsers({ prisma, keepUserId: config.keepUserId });

    console.log("Protected administrator:");
    console.table([result.keptUser]);
    console.log("Deleted legacy users:");
    console.table(result.deletedUsers);
    console.log("Deleted related data:");
    console.table([result.deleted]);
}

main()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
