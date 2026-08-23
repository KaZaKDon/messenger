import express from "express";
import { requireAuth } from "../auth/middleware.js";
import { prisma } from "../db/prisma.js";
import { blockUser, listBlockedUsers, unblockUser } from "../contacts/userBlockService.js";

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
    try { res.json({ users: await listBlockedUsers(prisma, req.auth.user.id) }); }
    catch (error) { next(error); }
});

router.post("/:userId", async (req, res, next) => {
    try { res.status(201).json({ user: await blockUser(prisma, req.auth.user.id, req.params.userId) }); }
    catch (error) { next(error); }
});

router.delete("/:userId", async (req, res, next) => {
    try { await unblockUser(prisma, req.auth.user.id, req.params.userId); res.status(204).end(); }
    catch (error) { next(error); }
});

export default router;
