import express from "express";
import { prisma } from "../db/prisma.js";
import { requireAdmin, requireAuth } from "../auth/middleware.js";
import { publicUser } from "../auth/session.js";

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get("/registrations", async (req, res) => {
    const status = req.query.status === "rejected" ? "rejected" : "pending";
    const users = await prisma.user.findMany({
        where: { status },
        orderBy: { createdAt: "asc" },
        take: 200,
    });
    return res.json(users.map((user) => ({ ...publicUser(user), approvalCode: user.approvalCode, createdAt: user.createdAt })));
});

router.patch("/registrations/:userId", async (req, res) => {
    const decision = req.body.decision;
    if (decision !== "approve" && decision !== "reject") {
        return res.status(400).json({ error: "decision must be approve or reject" });
    }

    const current = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!current) return res.status(404).json({ error: "Пользователь не найден" });
    if (current.status !== "pending") return res.status(409).json({ error: "Заявка уже обработана" });

    const status = decision === "approve" ? "active" : "rejected";
    const [user] = await prisma.$transaction([
        prisma.user.update({ where: { id: current.id }, data: { status } }),
        prisma.auditLog.create({
            data: {
                adminId: req.auth.user.id,
                action: `registration.${decision}`,
                targetId: current.id,
                details: { previousStatus: current.status, nextStatus: status },
            },
        }),
    ]);

    return res.json({ user: publicUser(user) });
});

export default router;