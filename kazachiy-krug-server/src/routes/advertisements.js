import express from "express";

import { requireAuth } from "../auth/middleware.js";
import { prisma } from "../db/prisma.js";
import {
    createAdvertisement,
    deleteOwnAdvertisement,
    editAdvertisement,
    expireAdvertisements,
    extendAdvertisement,
} from "../advertisements/advertisementService.js";
import {
    getAdvertisementGroupSummaries,
    markAdvertisementGroupRead,
} from "../advertisements/advertisementReadService.js";

const router = express.Router();
router.use(requireAuth);

const advertisementInclude = {
    images: { orderBy: { sortOrder: "asc" } },
    author: {
        select: { id: true, name: true, phone: true, avatar: true },
    },
    groupRule: {
        select: { chatId: true, contentType: true, advertisementLifetimeDays: true, requiresAnnouncementWithImage: true },
    },
};

function notifyAdvertisementChanged(req, advertisement) {
    if (!advertisement?.chatId) return;
    req.app.get("io")?.emit("advertisement:changed", { chatId: advertisement.chatId });
}

router.get("/group-summaries", async (req, res, next) => {
    try {
        const summaries = await getAdvertisementGroupSummaries({
            prisma,
            actor: req.auth.user,
        });
        return res.json(summaries);
    } catch (error) {
        return next(error);
    }
});

router.post("/groups/:chatId/read", async (req, res, next) => {
    try {
        await markAdvertisementGroupRead({
            prisma,
            actor: req.auth.user,
            chatId: req.params.chatId,
        });
        return res.status(204).end();
    } catch (error) {
        return next(error);
    }
});

router.get("/", async (req, res) => {
    await expireAdvertisements({ prisma });
    const own = req.query.mine === "true";
    const chatId = typeof req.query.chatId === "string" ? req.query.chatId.trim() : "";
    const where = own
        ? { authorId: req.auth.user.id, status: { not: "deleted" } }
        : {
            status: "active",
            ...(chatId ? { chatId } : {}),
            groupRule: { status: "active", visibility: "public" },
        };
    const advertisements = await prisma.advertisement.findMany({
        where,
        include: advertisementInclude,
        orderBy: { publishedAt: "desc" },
        take: 200,
    });
    return res.json(advertisements);
});

router.post("/", async (req, res, next) => {
    try {
        const advertisement = await createAdvertisement({
            prisma,
            actor: req.auth.user,
            chatId: req.body?.chatId,
            source: req.body,
        });
        notifyAdvertisementChanged(req, advertisement);
        return res.status(201).json({ advertisement });
    } catch (error) {
        return next(error);
    }
});

router.patch("/:advertisementId", async (req, res, next) => {
    try {
        const advertisement = await editAdvertisement({
            prisma,
            actor: req.auth.user,
            advertisementId: req.params.advertisementId,
            source: req.body,
        });
        notifyAdvertisementChanged(req, advertisement);
        return res.json({ advertisement });
    } catch (error) {
        return next(error);
    }
});

router.post("/:advertisementId/extend", async (req, res, next) => {
    try {
        const advertisement = await extendAdvertisement({
            prisma,
            actor: req.auth.user,
            advertisementId: req.params.advertisementId,
        });
        notifyAdvertisementChanged(req, advertisement);
        return res.json({ advertisement });
    } catch (error) {
        return next(error);
    }
});

router.delete("/:advertisementId", async (req, res, next) => {
    try {
        const advertisement = await deleteOwnAdvertisement({
            prisma,
            actor: req.auth.user,
            advertisementId: req.params.advertisementId,
        });
        notifyAdvertisementChanged(req, advertisement);
        return res.json({ advertisement });
    } catch (error) {
        return next(error);
    }
});

export default router;
