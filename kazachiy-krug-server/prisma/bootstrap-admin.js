import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { hashPassword } from "../src/auth/password.js";

const prisma = new PrismaClient();

function required(name) {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required`);
    return value;
}

async function main() {
    const login = required("ADMIN_LOGIN");
    const password = required("ADMIN_PASSWORD");
    const phone = required("ADMIN_PHONE").replace(/\D/g, "");
    const name = process.env.ADMIN_NICK?.trim() || "Администратор";
    if (password.length < 12) throw new Error("ADMIN_PASSWORD must contain at least 12 characters");

    const user = await prisma.user.findUnique({ where: { login } });
    const passwordHash = await hashPassword(password);
    const data = { name, phone: `+${phone}`, passwordHash, status: "active", role: "admin", approvalCode: null };

    const admin = user
        ? await prisma.user.update({ where: { id: user.id }, data })
        : await prisma.user.create({ data: { id: randomUUID(), login, ...data } });

    console.log(`Admin account is ready: ${admin.login}`);
}

main()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());