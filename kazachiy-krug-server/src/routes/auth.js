import { randomInt, randomUUID } from "node:crypto";
import express from "express";
import { prisma } from "../db/prisma.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { createSession, findSessionUser, publicUser, readBearerToken, revokeSession } from "../auth/session.js";

const router = express.Router();
const LOGIN_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

function clean(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value) {
    const digits = clean(value).replace(/\D/g, "");
    return digits ? `+${digits}` : "";
}

function createNumericCode() {
    return String(randomInt(100_000, 1_000_000));
}

async function createUniqueCode(model, field) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const code = createNumericCode();
        const exists = await model.findUnique({ where: { [field]: code }, select: { id: true } });
        if (!exists) return code;
    }
    throw new Error("Could not allocate a unique confirmation code");
}

router.post("/register", async (req, res) => {
    const login = clean(req.body.login);
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const phone = normalizePhone(req.body.phone);
    const name = clean(req.body.name);

    if (!LOGIN_RE.test(login)) return res.status(400).json({ error: "Логин: 3–32 латинских символа, цифры, точка, дефис или _" });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: "Пароль должен содержать от 8 до 128 символов" });
    if (phone.length < 11 || phone.length > 16) return res.status(400).json({ error: "Введите корректный номер телефона" });
    if (name.length < 2 || name.length > 80) return res.status(400).json({ error: "Имя должно содержать от 2 до 80 символов" });

    const duplicate = await prisma.user.findFirst({ where: { OR: [{ login }, { phone }] }, select: { login: true, phone: true } });
    if (duplicate) return res.status(409).json({ error: duplicate.login === login ? "Логин уже занят" : "Телефон уже зарегистрирован" });

    const approvalCode = await createUniqueCode(prisma.user, "approvalCode");
    const user = await prisma.user.create({
        data: { id: randomUUID(), login, passwordHash: await hashPassword(password), phone, name, approvalCode, status: "pending" },
    });
    return res.status(201).json({ user: publicUser(user), approvalCode });
});

router.post("/login", async (req, res) => {
    const login = clean(req.body.login);
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const user = await prisma.user.findUnique({ where: { login } });
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
        return res.status(401).json({ error: "Неверный логин или пароль" });
    }
    if (user.status !== "active") {
        return res.status(403).json({
            error: user.status === "pending" ? "Аккаунт ожидает подтверждения" : "Доступ к аккаунту ограничен",
            status: user.status,
            approvalCode: user.status === "pending" ? user.approvalCode : null,
            phone: user.status === "pending" ? user.phone : null,
        });
    }
    const session = await createSession(user.id);
    return res.json({ user: publicUser(user), accessToken: session.token, expiresAt: session.expiresAt });
});

router.post("/recovery", async (req, res) => {
    const login = clean(req.body.login);
    const phone = normalizePhone(req.body.phone);
    const visibleCode = createNumericCode();
    const user = await prisma.user.findFirst({ where: { login, phone }, select: { id: true } });

    if (user) {
        const requestCode = await createUniqueCode(prisma.passwordRecoveryRequest, "requestCode");
        await prisma.passwordRecoveryRequest.create({
            data: {
                userId: user.id,
                requestCode,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });
        return res.status(202).json({ requestCode });
    }

    return res.status(202).json({ requestCode: visibleCode });
});

router.post("/registration-status", async (req, res) => {
    const phone = normalizePhone(req.body.phone);
    const approvalCode = clean(req.body.approvalCode);
    const user = await prisma.user.findFirst({ where: { phone, approvalCode }, select: { status: true } });
    if (!user) return res.status(404).json({ error: "Заявка не найдена" });
    return res.json({ status: user.status });
});

router.get("/session", async (req, res) => {
    const auth = await findSessionUser(readBearerToken(req));
    if (!auth) return res.status(401).json({ error: "Сессия недействительна" });
    return res.json({ user: publicUser(auth.user) });
});

router.post("/logout", async (req, res) => {
    await revokeSession(readBearerToken(req));
    return res.status(204).end();
});

export default router;