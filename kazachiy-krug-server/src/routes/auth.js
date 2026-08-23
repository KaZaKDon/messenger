import express from "express";
import { prisma } from "../db/prisma.js";
import { verifyPassword } from "../auth/password.js";
import { publicUser } from "../auth/publicUser.js";
import { createSession, findSessionUser, readBearerToken, revokeSession } from "../auth/session.js";
import { readRegistrationConfig, RegistrationConfigError } from "../registration/config.js";
import { RegistrationValidationError } from "../registration/applicationValidation.js";
import { normalizeRussianMobilePhone } from "../registration/phone.js";
import {
    createRegistrationApplication,
    RegistrationConflictError,
} from "../registration/registrationService.js";
import { findRegistrationStatus } from "../registration/statusService.js";
import {
    completePasswordRecovery,
    createPasswordRecoveryRequest,
    getPasswordRecoveryStatus,
    PasswordRecoveryError,
} from "../recovery/passwordRecoveryService.js";

const router = express.Router();

function clean(value) {
    return typeof value === "string" ? value.trim() : "";
}

function loginConditions(identifier) {
    const value = clean(identifier);
    if (!value) return [];

    const conditions = [{ login: value }];
    const phone = normalizeRussianMobilePhone(value);
    if (phone) conditions.push({ phone });
    if (value.includes("@")) conditions.push({ email: value.toLowerCase() });
    return conditions;
}

function readContactSafely() {
    try {
        const config = readRegistrationConfig();
        return {
            contactPhone: config.contactPhone,
            contactPhoneDisplay: config.contactPhoneDisplay,
        };
    } catch {
        return { contactPhone: null, contactPhoneDisplay: null };
    }
}

router.post("/register", async (req, res, next) => {
    try {
        const result = await createRegistrationApplication({
            prisma,
            source: req.body,
            config: readRegistrationConfig(),
            metadata: {
                ipAddress: req.ip,
                userAgent: req.get("user-agent"),
            },
        });
        return res.status(201).json({
            user: publicUser(result.user),
            approvalCode: result.approvalCode,
            expiresAt: result.expiresAt,
            contactPhone: result.contactPhone,
            contactPhoneDisplay: result.contactPhoneDisplay,
        });
    } catch (error) {
        if (error instanceof RegistrationValidationError) {
            return res.status(400).json({ error: error.message, field: error.field });
        }
        if (error instanceof RegistrationConflictError) {
            return res.status(409).json({ error: error.message, field: error.field });
        }
        if (error instanceof RegistrationConfigError) {
            console.error("registration config failed:", error.message);
            return res.status(503).json({ error: "Регистрация временно недоступна" });
        }
        return next(error);
    }
});

router.post("/login", async (req, res) => {
    const identifier = req.body.identifier ?? req.body.login;
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const conditions = loginConditions(identifier);
    const user = conditions.length
        ? await prisma.user.findFirst({ where: { OR: conditions } })
        : null;
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
        return res.status(401).json({ error: "Неверный телефон, email или пароль" });
    }
    if (user.status !== "active") {
        const application = user.status === "pending"
            ? await prisma.registrationApplication.findUnique({
                where: { userId: user.id },
                select: { approvalCode: true, expiresAt: true },
            })
            : null;
        return res.status(403).json({
            error: user.status === "pending" ? "Аккаунт ожидает подтверждения" : "Доступ к аккаунту ограничен",
            status: user.status,
            approvalCode: application?.approvalCode ?? user.approvalCode ?? null,
            registrationId: user.status === "pending" ? user.id : null,
            expiresAt: application?.expiresAt ?? null,
            phone: user.status === "pending" ? user.phone : null,
            ...(user.status === "pending" ? readContactSafely() : {}),
        });
    }
    const session = await createSession(user.id);
    return res.json({ user: publicUser(user), accessToken: session.token, expiresAt: session.expiresAt });
});

router.post("/recovery", async (req, res, next) => {
    try {
        const result = await createPasswordRecoveryRequest({
            prisma,
            phone: req.body?.phone,
            contact: readContactSafely(),
        });
        return res.status(202).json(result);
    } catch (error) {
        if (error instanceof PasswordRecoveryError) {
            return res.status(error.statusCode).json({ error: error.message, field: error.field });
        }
        return next(error);
    }
});

router.post("/recovery/status", async (req, res, next) => {
    try {
        const result = await getPasswordRecoveryStatus({
            prisma,
            recoveryId: req.body?.recoveryId,
            browserSecret: req.body?.browserSecret,
        });
        return res.json(result);
    } catch (error) {
        return next(error);
    }
});

router.post("/recovery/reset", async (req, res, next) => {
    try {
        const result = await completePasswordRecovery({ prisma, source: req.body });
        return res.json(result);
    } catch (error) {
        if (error instanceof PasswordRecoveryError) {
            return res.status(error.statusCode).json({ error: error.message, field: error.field });
        }
        return next(error);
    }
});

router.post("/registration-status", async (req, res) => {
    const result = await findRegistrationStatus({ prisma, source: req.body });
    if (!result) return res.status(404).json({ error: "Заявка не найдена" });
    return res.json(result);
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
