import { PrismaClient, ChatType, GroupMode } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const users = [
        { id: "user-1", name: "Казак", phone: "+79515220669", avatar: null },
        { id: "user-2", name: "Наташа", phone: "+79515260822", avatar: null },
        { id: "user-3", name: "Дима", phone: "+79381532981", avatar: null },
        { id: "user-4", name: "Наташа2", phone: "+79613079128", avatar: null },
        { id: "user-5", name: "Надя", phone: "+79281256900", avatar: null },
        { id: "user-6", name: "Рафиковна", phone: "+79289883569", avatar: null },
        { id: "user-7", name: "Рыжий", phone: "+79202695276", avatar: null },
    ];

    for (const u of users) {
        await prisma.user.upsert({
            where: { id: u.id },
            update: { name: u.name, phone: u.phone, avatar: u.avatar },
            create: u,
        });
    }

    const chats = [
        { id: "room-user-1-user-2", type: ChatType.private, title: null },

        { id: "group-1", type: ChatType.group, title: "Нужное" },
        { id: "group-2", type: ChatType.group, title: "Администрация" },
        { id: "group-3", type: ChatType.group, title: "Музеи" },
        { id: "group-4", type: ChatType.group, title: "Недвижимость " },
        { id: "group-5", type: ChatType.group, title: "Домашние животные" },
        { id: "group-6", type: ChatType.group, title: "Сад и Огород" },
        { id: "group-7", type: ChatType.group, title: "Сельскохозяйственные животные" },
        { id: "group-8", type: ChatType.group, title: "Транспорт" },
        { id: "group-9", type: ChatType.group, title: "Строительство Стройматериалы" },
        { id: "group-10", type: ChatType.group, title: "Личные вещи" },
        { id: "group-11", type: ChatType.group, title: "Услуги" },
        { id: "group-12", type: ChatType.group, title: "ПОБОЛТАЕМ" },
        { id: "group-13", type: ChatType.group, title: "010" },
    ];

    for (const c of chats) {
        await prisma.chat.upsert({
            where: { id: c.id },
            update: { type: c.type, title: c.title },
            create: c,
        });
    }

    const groupRules = [
        { chatId: "group-1", mode: GroupMode.readonly, requiresAnnouncementWithImage: false, publishUserIds: ["user-1"] },
        { chatId: "group-2", mode: GroupMode.readonly, requiresAnnouncementWithImage: false, publishUserIds: ["user-1"] },
        { chatId: "group-3", mode: GroupMode.readonly, requiresAnnouncementWithImage: false, publishUserIds: ["user-1"] },


        { chatId: "group-4", mode: GroupMode.announcements, requiresAnnouncementWithImage: true },
        { chatId: "group-5", mode: GroupMode.announcements, requiresAnnouncementWithImage: true },
        { chatId: "group-6", mode: GroupMode.announcements, requiresAnnouncementWithImage: true },
        { chatId: "group-7", mode: GroupMode.announcements, requiresAnnouncementWithImage: true },
        { chatId: "group-8", mode: GroupMode.announcements, requiresAnnouncementWithImage: true },
        { chatId: "group-9", mode: GroupMode.announcements, requiresAnnouncementWithImage: true },
        { chatId: "group-10", mode: GroupMode.announcements, requiresAnnouncementWithImage: true },
        { chatId: "group-11", mode: GroupMode.announcements, requiresAnnouncementWithImage: true },

        { chatId: "group-12", mode: GroupMode.chat, requiresAnnouncementWithImage: false },
        { chatId: "group-13", mode: GroupMode.chat, requiresAnnouncementWithImage: false },
    ];

    for (const gr of groupRules) {
        await prisma.groupRule.upsert({
            where: { chatId: gr.chatId },
            update: {
                mode: gr.mode,
                requiresAnnouncementWithImage: gr.requiresAnnouncementWithImage,
                publishUserIds: gr.publishUserIds ?? null,
            },
            create: gr,
        });
    }

    const allUsers = users.map((u) => u.id);
    const restrictedGroupId = "group-12";
    const restrictedMembers = ["user-1", "user-7"];

    const privateMembers = [
        { chatId: "room-user-1-user-2", userId: "user-1", role: "member" },
        { chatId: "room-user-1-user-2", userId: "user-2", role: "member" },
    ];

    const groupMembers = [];
    const publicGroupIds = chats
        .filter((c) => c.type === ChatType.group && c.id !== restrictedGroupId)
        .map((c) => c.id);

    for (const chatId of publicGroupIds) {
        for (const userId of allUsers) {
            groupMembers.push({ chatId, userId, role: "member" });
        }
    }

    for (const userId of restrictedMembers) {
        groupMembers.push({ chatId: restrictedGroupId, userId, role: "member" });
    }

    const members = [...privateMembers, ...groupMembers];

    for (const m of members) {
        await prisma.chatMember.upsert({
            where: { chatId_userId: { chatId: m.chatId, userId: m.userId } },
            update: { role: m.role },
            create: m,
        });
    }

    for (const u of users) {
        await prisma.userSettings.upsert({
            where: { userId: u.id },
            update: {},
            create: { userId: u.id, theme: "light", notificationsEnabled: true },
        });
    }

    console.log("✅ Seed completed");
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
