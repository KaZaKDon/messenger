import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const HISTORY_SIZE = 120;

const TARGET_CHATS = [
    {
        chatId: "room-user-1-user-2",
        senderIds: ["user-1", "user-2"],
        label: "Личка user-1/user-2",
    },
    {
        chatId: "group-11",
        senderIds: ["user-1", "user-2", "user-3", "user-4"],
        label: "Группа group-11",
    },
];

async function seedChatHistory({ chatId, senderIds, label }) {
    const chat = await prisma.chat.findUnique({
        where: { id: chatId },
        select: { id: true },
    });

    if (!chat) {
        console.warn(`⚠️ Пропуск ${label}: чат ${chatId} не найден`);
        return;
    }

    await prisma.message.deleteMany({
        where: {
            chatId,
            text: {
                startsWith: "[seed-history]",
            },
        },
    });

    const now = Date.now();
    const data = Array.from({ length: HISTORY_SIZE }, (_, i) => {
        const senderId = senderIds[i % senderIds.length];
        return {
            chatId,
            senderId,
            text: `[seed-history] ${label} сообщение #${i + 1}`,
            status: "sent",
            createdAt: new Date(now - (HISTORY_SIZE - i) * 60_000),
        };
    });

    await prisma.message.createMany({ data });

    console.log(`✅ ${label}: добавлено ${HISTORY_SIZE} сообщений для проверки пагинации`);
}

async function main() {
    for (const target of TARGET_CHATS) {
        await seedChatHistory(target);
    }
}

main()
    .catch((e) => {
        console.error("❌ seed-history failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
