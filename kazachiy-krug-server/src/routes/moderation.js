import express from "express";

import { blockUser } from "../accounts/accountModerationService.js";
import { moderateAdvertisement } from "../advertisements/advertisementService.js";
import { requireModeratorOrAdmin } from "../auth/authorization.js";
import { requireAuth } from "../auth/middleware.js";
import { publicUser } from "../auth/publicUser.js";
import {
    staffPrivateProfileSelect,
    withStaffPrivateProfile,
} from "../accounts/staffUserProfile.js";
import { prisma } from "../db/prisma.js";
import {
    changeGroupStatus,
    listGroupCandidates,
    listManagedGroups,
    setGroupMember,
    setGroupPublisher,
} from "../groups/groupManagementService.js";
import { reviewComplaint } from "../moderation/complaintService.js";
import {
    answerSupportRequest,
    closeSupportRequest,
    startSupportRequest,
} from "../moderation/supportRequestService.js";

const router = express.Router();
router.use(requireAuth, requireModeratorOrAdmin);

const publicProfileSelect = {
    id: true,
    name: true,
    phone: true,
    avatar: true,
    role: true,
    status: true,
    ...staffPrivateProfileSelect,
};

router.get("/users", async (req, res) => {
    const status = ["active", "blocked"].includes(req.query.status)
        ? req.query.status
        : { in: ["active", "blocked"] };
    const users = await prisma.user.findMany({
        where: { status, role: "user" },
        select: publicProfileSelect,
        orderBy: { createdAt: "desc" },
        take: 500,
    });
    return res.json(users.map(withStaffPrivateProfile));
});

router.post("/users/:userId/block", async (req, res, next) => {
    try {
        const user = await blockUser({
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

router.get("/groups", async (req, res, next) => {
    try {
        const groups = await listManagedGroups({ prisma, actor: req.auth.user });
        return res.json({ groups, total: groups.length });
    } catch (error) {
        return next(error);
    }
});

router.get("/group-candidates", async (req, res, next) => {
    try {
        const users = await listGroupCandidates({ prisma, actor: req.auth.user });
        return res.json(users);
    } catch (error) {
        return next(error);
    }
});

router.patch("/groups/:chatId/status", async (req, res, next) => {
    try {
        const group = await changeGroupStatus({
            prisma,
            actor: req.auth.user,
            chatId: req.params.chatId,
            status: req.body?.status,
            reason: req.body?.reason,
        });
        return res.json({ group });
    } catch (error) {
        return next(error);
    }
});

router.put("/groups/:chatId/members/:userId", async (req, res, next) => {
    try {
        await setGroupMember({
            prisma,
            actor: req.auth.user,
            chatId: req.params.chatId,
            userId: req.params.userId,
            assigned: true,
        });
        return res.status(204).end();
    } catch (error) {
        return next(error);
    }
});

router.delete("/groups/:chatId/members/:userId", async (req, res, next) => {
    try {
        await setGroupMember({
            prisma,
            actor: req.auth.user,
            chatId: req.params.chatId,
            userId: req.params.userId,
            assigned: false,
        });
        return res.status(204).end();
    } catch (error) {
        return next(error);
    }
});

router.put("/groups/:chatId/publishers/:userId", async (req, res, next) => {
    try {
        await setGroupPublisher({
            prisma,
            actor: req.auth.user,
            chatId: req.params.chatId,
            userId: req.params.userId,
            assigned: true,
        });
        return res.status(204).end();
    } catch (error) {
        return next(error);
    }
});

router.delete("/groups/:chatId/publishers/:userId", async (req, res, next) => {
    try {
        await setGroupPublisher({
            prisma,
            actor: req.auth.user,
            chatId: req.params.chatId,
            userId: req.params.userId,
            assigned: false,
        });
        return res.status(204).end();
    } catch (error) {
        return next(error);
    }
});

router.get("/advertisements", async (req, res) => {
    const allowed = ["active", "needs_edit", "removed", "expired", "deleted"];
    const status = allowed.includes(req.query.status) ? req.query.status : { in: allowed };
    const advertisements = await prisma.advertisement.findMany({
        where: { status },
        include: {
            images: { orderBy: { sortOrder: "asc" } },
            author: { select: publicProfileSelect },
            moderatedBy: { select: publicProfileSelect },
            groupRule: {
                select: {
                    chatId: true,
                    contentType: true,
                    advertisementLifetimeDays: true,
                    chat: { select: { title: true } },
                },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 300,
    });
    return res.json(advertisements);
});

router.patch("/advertisements/:advertisementId", async (req, res, next) => {
    try {
        const advertisement = await moderateAdvertisement({
            prisma,
            actor: req.auth.user,
            advertisementId: req.params.advertisementId,
            status: req.body?.status,
            reason: req.body?.reason,
        });
        req.app.get("io")?.emit("advertisement:changed", { chatId: advertisement.chatId });
        return res.json({ advertisement });
    } catch (error) {
        return next(error);
    }
});

router.get("/complaints", async (req, res) => {
    const allowed = ["new", "in_review", "resolved", "rejected"];
    const status = allowed.includes(req.query.status) ? req.query.status : { in: allowed };
    const complaints = await prisma.complaint.findMany({
        where: { status },
        include: {
            reporter: { select: publicProfileSelect },
            assignedTo: { select: publicProfileSelect },
        },
        orderBy: { createdAt: "desc" },
        take: 300,
    });
    return res.json(complaints);
});

router.patch("/complaints/:complaintId", async (req, res, next) => {
    try {
        const complaintTarget = req.body?.advertisementAction && req.body.advertisementAction !== "none"
            ? await prisma.complaint.findUnique({
                where: { id: req.params.complaintId },
                select: { targetId: true, targetType: true },
            })
            : null;
        const complaint = await reviewComplaint({
            prisma,
            actor: req.auth.user,
            complaintId: req.params.complaintId,
            status: req.body?.status,
            resolution: req.body?.resolution,
            advertisementAction: req.body?.advertisementAction,
            actionReason: req.body?.actionReason,
        });
        if (complaintTarget?.targetType === "advertisement") {
            const advertisement = await prisma.advertisement.findUnique({
                where: { id: complaintTarget.targetId },
                select: { chatId: true },
            });
            if (advertisement?.chatId) {
                req.app.get("io")?.emit("advertisement:changed", { chatId: advertisement.chatId });
            }
        }
        return res.json({ complaint });
    } catch (error) {
        return next(error);
    }
});

router.get("/support-requests", async (req, res) => {
    const allowed = ["new", "in_progress", "answered", "closed"];
    const status = allowed.includes(req.query.status) ? req.query.status : { in: allowed };
    const requests = await prisma.supportRequest.findMany({
        where: { status },
        include: {
            author: { select: publicProfileSelect },
            assignedTo: { select: publicProfileSelect },
            messages: {
                orderBy: { createdAt: "asc" },
                include: { author: { select: publicProfileSelect } },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 300,
    });
    return res.json(requests);
});

router.post("/support-requests/:requestId/answer", async (req, res, next) => {
    try {
        const request = await answerSupportRequest({
            prisma,
            actor: req.auth.user,
            requestId: req.params.requestId,
            text: req.body?.text,
        });
        return res.json({ request });
    } catch (error) {
        return next(error);
    }
});

router.post("/support-requests/:requestId/start", async (req, res, next) => {
    try {
        const request = await startSupportRequest({
            prisma,
            actor: req.auth.user,
            requestId: req.params.requestId,
        });
        return res.json({ request });
    } catch (error) {
        return next(error);
    }
});

router.post("/support-requests/:requestId/close", async (req, res, next) => {
    try {
        const request = await closeSupportRequest({
            prisma,
            actor: req.auth.user,
            requestId: req.params.requestId,
        });
        return res.json({ request });
    } catch (error) {
        return next(error);
    }
});

export default router;
