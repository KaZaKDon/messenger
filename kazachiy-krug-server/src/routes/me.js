import express from "express";

import { prisma } from "../db/prisma.js";
import { usersById } from "../store/users.js";
import { requireAuth } from "../auth/middleware.js";
import { avatarUpload, removeLocalAvatar } from "../profile/avatarUpload.js";
import {
    getUserProfile,
    profilePayload,
    updateUserProfile,
} from "../profile/userProfileService.js";

const router = express.Router();
router.use(requireAuth);

async function findUserById(userId) {
    try {
        const dbUser = await prisma.user.findUnique({ where: { id: userId } });
        if (dbUser) return dbUser;
    } catch {
        // database can be unavailable in local-dev mode
    }

    return usersById[userId] ?? null;
}

router.get("/me", async (req, res) => {
    const userId = req.auth.user.id;

    const user = await findUserById(userId);

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    return res.json(await getUserProfile({ prisma, user }));
});

router.patch("/me", async (req, res, next) => {
    const userId = req.auth.user.id;

    const user = await findUserById(userId);

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    try {
        return res.json(await updateUserProfile({ prisma, user, source: req.body }));
    } catch (error) {
        return next(error);
    }
});

router.post("/me/avatar", (req, res, next) => {
    avatarUpload.single("avatar")(req, res, async (error) => {
        if (error) {
            const message = error.code === "LIMIT_FILE_SIZE"
                ? "Размер аватара не должен превышать 5 МБ"
                : error.message;
            return res.status(400).json({ error: message });
        }
        if (!req.file) return res.status(400).json({ error: "Выберите изображение" });

        try {
            const avatar = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
            const previousAvatar = req.auth.user.avatar;
            const user = await prisma.user.update({
                where: { id: req.auth.user.id },
                data: { avatar },
            });
            removeLocalAvatar(previousAvatar);
            const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });
            return res.json({ user: profilePayload(user, profile) });
        } catch (updateError) {
            removeLocalAvatar(`${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`);
            return next(updateError);
        }
    });
});

router.delete("/me/avatar", async (req, res, next) => {
    try {
        const previousAvatar = req.auth.user.avatar;
        const user = await prisma.user.update({
            where: { id: req.auth.user.id },
            data: { avatar: null },
        });
        removeLocalAvatar(previousAvatar);
        const profile = await prisma.userProfile.findUnique({ where: { userId: user.id } });
        return res.json({ user: profilePayload(user, profile) });
    } catch (error) {
        return next(error);
    }
});

export default router;
