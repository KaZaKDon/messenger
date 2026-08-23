import express from "express";

import { requireAuth } from "../auth/middleware.js";
import { prisma } from "../db/prisma.js";
import { createComplaint } from "../moderation/complaintService.js";

const router = express.Router();
router.use(requireAuth);

router.get("/mine", async (req, res) => {
    const complaints = await prisma.complaint.findMany({
        where: { reporterId: req.auth.user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
            id: true,
            targetType: true,
            targetId: true,
            reason: true,
            details: true,
            status: true,
            resolution: true,
            resolvedAt: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    return res.json(complaints);
});

router.post("/", async (req, res, next) => {
    try {
        const complaint = await createComplaint({
            prisma,
            actor: req.auth.user,
            source: req.body,
        });
        return res.status(201).json({ complaint });
    } catch (error) {
        return next(error);
    }
});

export default router;
