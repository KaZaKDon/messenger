import express from "express";
import { requireAuth } from "../auth/middleware.js";
import { prisma } from "../db/prisma.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
    const settlements = await prisma.settlement.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
    });
    res.json(settlements);
});

export default router;
