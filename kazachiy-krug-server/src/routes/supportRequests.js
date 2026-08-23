import express from "express";

import { requireAuth } from "../auth/middleware.js";
import { prisma } from "../db/prisma.js";
import {
    addSupportRequestMessage,
    closeSupportRequest,
    createSupportRequest,
    markSupportRequestRead,
} from "../moderation/supportRequestService.js";

const router = express.Router();
router.use(requireAuth);

router.get("/mine", async (req, res) => {
    const requests = await prisma.supportRequest.findMany({
        where: { authorId: req.auth.user.id },
        include: {
            messages: {
                orderBy: { createdAt: "asc" },
                select: { id: true, authorId: true, text: true, createdAt: true },
            },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
    });
    return res.json(requests.map((request) => ({
        ...request,
        unread: Boolean(
            request.lastStaffMessageAt
            && (!request.authorLastReadAt || request.lastStaffMessageAt > request.authorLastReadAt)
        ),
    })));
});

router.get("/unread-count", async (req, res) => {
    const requests = await prisma.supportRequest.findMany({
        where: { authorId: req.auth.user.id, lastStaffMessageAt: { not: null } },
        select: { authorLastReadAt: true, lastStaffMessageAt: true },
    });
    const unread = requests.filter((request) => (
        request.lastStaffMessageAt
        && (!request.authorLastReadAt || request.lastStaffMessageAt > request.authorLastReadAt)
    )).length;
    return res.json({ unread });
});

router.post("/", async (req, res, next) => {
    try {
        const request = await createSupportRequest({
            prisma,
            actor: req.auth.user,
            source: req.body,
        });
        return res.status(201).json({ request });
    } catch (error) {
        return next(error);
    }
});

router.post("/:requestId/messages", async (req, res, next) => {
    try {
        const message = await addSupportRequestMessage({
            prisma,
            actor: req.auth.user,
            requestId: req.params.requestId,
            text: req.body?.text,
        });
        return res.status(201).json({ message });
    } catch (error) {
        return next(error);
    }
});

router.post("/:requestId/close", async (req, res, next) => {
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

router.post("/:requestId/read", async (req, res, next) => {
    try {
        await markSupportRequestRead({
            prisma,
            actor: req.auth.user,
            requestId: req.params.requestId,
        });
        return res.status(204).end();
    } catch (error) {
        return next(error);
    }
});

export default router;
