import express from "express";
import { prisma } from "../db/prisma.js";
import { requireAdmin } from "../auth/authorization.js";
import { requireAuth } from "../auth/middleware.js";
import { publicUser } from "../auth/publicUser.js";
import {
    softDeleteUser,
    unblockUser,
} from "../accounts/accountModerationService.js";
import { setModeratorRole } from "../accounts/moderatorManagementService.js";
import {
    recordGroupPayment,
    voidGroupPayment,
} from "../payments/groupPaymentService.js";
import {
    clearGroupOwner,
    createManagedGroup,
    setGroupOwner,
    updateManagedGroup,
} from "../groups/groupManagementService.js";
import {
    RegistrationReviewError,
    reviewRegistrationApplication,
} from "../registration/reviewService.js";
import { createSettlement, updateSettlement } from "../settlements/settlementService.js";
import {
    staffPrivateProfileSelect,
    withStaffPrivateProfile,
} from "../accounts/staffUserProfile.js";
import {
    PasswordRecoveryError,
    reviewPasswordRecovery,
} from "../recovery/passwordRecoveryService.js";

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get("/users", async (req, res) => {
    const statuses = ["pending", "active", "rejected", "blocked", "deleted"];
    const status = statuses.includes(req.query.status) ? req.query.status : { in: statuses };
    const [users, groupedCounts] = await Promise.all([
        prisma.user.findMany({
            where: { status },
            select: {
                id: true,
                login: true,
                email: true,
                name: true,
                phone: true,
                avatar: true,
                role: true,
                status: true,
                createdAt: true,
                blockedAt: true,
                blockReason: true,
                deletedAt: true,
                deletionReason: true,
                ...staffPrivateProfileSelect,
            },
            orderBy: { createdAt: "desc" },
            take: 1000,
        }),
        prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(statuses.map((item) => [item, 0]));
    for (const item of groupedCounts) counts[item.status] = item._count._all;
    return res.json({
        users: users.map(withStaffPrivateProfile),
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
    });
});

router.post("/users/:userId/unblock", async (req, res, next) => {
    try {
        const user = await unblockUser({
            prisma,
            actor: req.auth.user,
            userId: req.params.userId,
        });
        return res.json({ user: publicUser(user) });
    } catch (error) {
        return next(error);
    }
});

router.delete("/users/:userId", async (req, res, next) => {
    try {
        const user = await softDeleteUser({
            prisma,
            actor: req.auth.user,
            userId: req.params.userId,
            reason: req.body?.reason,
        });
        return res.json({ user: publicUser(user) });
    } catch (error) {
        return next(error);
    }
});

const moderatorProfileSelect = {
    id: true,
    login: true,
    email: true,
    name: true,
    phone: true,
    avatar: true,
    role: true,
    status: true,
    createdAt: true,
    blockedAt: true,
    blockReason: true,
};

router.get("/moderators", async (_req, res) => {
    const [moderators, candidates] = await Promise.all([
        prisma.user.findMany({
            where: { role: "moderator", status: { in: ["active", "blocked"] } },
            select: moderatorProfileSelect,
            orderBy: { name: "asc" },
            take: 500,
        }),
        prisma.user.findMany({
            where: { role: "user", status: "active" },
            select: moderatorProfileSelect,
            orderBy: { name: "asc" },
            take: 1000,
        }),
    ]);
    return res.json({ moderators, candidates });
});

router.put("/moderators/:userId", async (req, res, next) => {
    try {
        const user = await setModeratorRole({
            prisma,
            actor: req.auth.user,
            userId: req.params.userId,
            assigned: true,
        });
        return res.json({ user: publicUser(user) });
    } catch (error) { return next(error); }
});

router.delete("/moderators/:userId", async (req, res, next) => {
    try {
        const user = await setModeratorRole({
            prisma,
            actor: req.auth.user,
            userId: req.params.userId,
            assigned: false,
        });
        return res.json({ user: publicUser(user) });
    } catch (error) { return next(error); }
});

router.get("/settlements", async (_req, res) => {
    const settlements = await prisma.settlement.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
    return res.json(settlements);
});

router.post("/settlements", async (req, res, next) => {
    try {
        const settlement = await createSettlement({ prisma, actor: req.auth.user, name: req.body?.name });
        await prisma.auditLog.create({ data: { adminId: req.auth.user.id, action: "settlement.created", targetId: settlement.id, details: { name: settlement.name } } });
        return res.status(201).json({ settlement });
    } catch (error) { return next(error); }
});

router.patch("/settlements/:settlementId", async (req, res, next) => {
    try {
        const settlement = await updateSettlement({ prisma, actor: req.auth.user, settlementId: req.params.settlementId, source: req.body });
        await prisma.auditLog.create({ data: { adminId: req.auth.user.id, action: "settlement.updated", targetId: settlement.id, details: { name: settlement.name, isActive: settlement.isActive } } });
        return res.json({ settlement });
    } catch (error) { return next(error); }
});

router.post("/groups", async (req, res, next) => {
    try {
        const group = await createManagedGroup({
            prisma,
            actor: req.auth.user,
            source: req.body,
        });
        return res.status(201).json({ group });
    } catch (error) {
        return next(error);
    }
});

router.patch("/groups/:chatId", async (req, res, next) => {
    try {
        const group = await updateManagedGroup({
            prisma,
            actor: req.auth.user,
            chatId: req.params.chatId,
            source: req.body,
        });
        return res.json({ group });
    } catch (error) {
        return next(error);
    }
});

router.put("/groups/:chatId/owner", async (req, res, next) => {
    try {
        const group = await setGroupOwner({
            prisma,
            actor: req.auth.user,
            chatId: req.params.chatId,
            source: req.body,
        });
        return res.json({ group });
    } catch (error) {
        return next(error);
    }
});

router.delete("/groups/:chatId/owner", async (req, res, next) => {
    try {
        const group = await clearGroupOwner({
            prisma,
            actor: req.auth.user,
            chatId: req.params.chatId,
            reason: req.body?.reason,
        });
        return res.json({ group });
    } catch (error) {
        return next(error);
    }
});

router.get("/payments", async (req, res) => {
    const payments = await prisma.groupPayment.findMany({
        include: {
            groupRule: { select: { chatId: true, chat: { select: { title: true } } } },
            owner: { select: { id: true, name: true, phone: true } },
            recordedBy: { select: { id: true, name: true } },
            voidedBy: { select: { id: true, name: true } },
        },
        orderBy: { paidAt: "desc" },
        take: 500,
    });
    return res.json(payments);
});

router.post("/payments", async (req, res, next) => {
    try {
        const payment = await recordGroupPayment({
            prisma,
            actor: req.auth.user,
            source: req.body,
        });
        return res.status(201).json({ payment });
    } catch (error) {
        return next(error);
    }
});

router.post("/payments/:paymentId/void", async (req, res, next) => {
    try {
        const payment = await voidGroupPayment({
            prisma,
            actor: req.auth.user,
            paymentId: req.params.paymentId,
            reason: req.body?.reason,
        });
        return res.json({ payment });
    } catch (error) {
        return next(error);
    }
});

router.get("/password-recoveries", async (req, res) => {
    const now = new Date();
    await prisma.passwordRecoveryRequest.updateMany({
        where: {
            status: { in: ["pending", "approved"] },
            expiresAt: { lte: now },
        },
        data: { status: "expired", resolvedAt: now },
    });
    const allowedStatuses = ["pending", "approved", "rejected", "completed", "expired"];
    const status = allowedStatuses.includes(req.query.status)
        ? req.query.status
        : { in: ["pending", "approved"] };
    const requests = await prisma.passwordRecoveryRequest.findMany({
        where: { status },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    phone: true,
                    avatar: true,
                    role: true,
                    status: true,
                    ...staffPrivateProfileSelect,
                },
            },
        },
        orderBy: { createdAt: "asc" },
        take: 200,
    });
    return res.json(requests.map((request) => ({
        id: request.id,
        requestCode: request.requestCode,
        status: request.status,
        expiresAt: request.expiresAt,
        createdAt: request.createdAt,
        reviewedAt: request.reviewedAt,
        reviewReason: request.reviewReason,
        user: withStaffPrivateProfile(request.user),
    })));
});

router.patch("/password-recoveries/:requestId", async (req, res, next) => {
    try {
        const request = await reviewPasswordRecovery({
            prisma,
            requestId: req.params.requestId,
            adminId: req.auth.user.id,
            source: req.body,
        });
        return res.json({ request: { id: request.id, status: request.status } });
    } catch (error) {
        if (error instanceof PasswordRecoveryError) {
            return res.status(error.statusCode).json({ error: error.message, field: error.field });
        }
        return next(error);
    }
});

router.get("/registrations", async (req, res) => {
    const status = req.query.status === "rejected" ? "rejected" : "pending";
    const users = await prisma.user.findMany({
        where: { status },
        orderBy: { createdAt: "asc" },
        take: 200,
        include: {
            registrationApplication: true,
            legalAcceptances: {
                where: { source: "registration" },
                select: { type: true, documentVersion: true, acceptedAt: true },
                orderBy: { acceptedAt: "asc" },
            },
        },
    });
    return res.json(users.map((user) => ({
        ...publicUser(user),
        email: user.email,
        createdAt: user.createdAt,
        application: user.registrationApplication ? {
            firstName: user.registrationApplication.firstName,
            lastName: user.registrationApplication.lastName,
            settlement: user.registrationApplication.settlement,
            occupation: user.registrationApplication.occupation,
            purposes: user.registrationApplication.purposes,
            purposeNote: user.registrationApplication.purposeNote,
            approvalCode: user.registrationApplication.approvalCode,
            expiresAt: user.registrationApplication.expiresAt,
            reviewedAt: user.registrationApplication.reviewedAt,
            reviewReason: user.registrationApplication.reviewReason,
        } : null,
        acceptances: user.legalAcceptances,
    })));
});

router.patch("/registrations/:userId", async (req, res, next) => {
    try {
        const user = await reviewRegistrationApplication({
            prisma,
            userId: req.params.userId,
            adminId: req.auth.user.id,
            source: req.body,
        });
        return res.json({ user: publicUser(user) });
    } catch (error) {
        if (error instanceof RegistrationReviewError) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        return next(error);
    }
});

export default router;
