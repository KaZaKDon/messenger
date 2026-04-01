import express from "express";

import { prisma } from "../db/prisma.js";
import { usersById } from "../store/users.js";

const router = express.Router();

const profileExtrasByUserId = new Map();

function getDefaultExtras() {
    return {
        region: "Ростов-на-Дону",
        occupation: "Торговец",
    };
}

function sanitizeString(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function toMePayload(user) {
    const extras = profileExtrasByUserId.get(user.id) ?? getDefaultExtras();

    return {
        id: user.id,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar ?? null,
        region: extras.region,
        occupation: extras.occupation,
    };
}

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
    const userId = sanitizeString(req.query.userId);

    if (!userId) {
        return res.status(400).json({ error: "userId is required" });
    }

    const user = await findUserById(userId);

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    return res.json(toMePayload(user));
});

router.patch("/me", async (req, res) => {
    const userId = sanitizeString(req.body.userId);

    if (!userId) {
        return res.status(400).json({ error: "userId is required" });
    }

    const user = await findUserById(userId);

    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    const nextPhone = sanitizeString(req.body.phone);
    const nextRegion = sanitizeString(req.body.region);
    const nextOccupation = sanitizeString(req.body.occupation);

    if (!nextPhone && !nextRegion && !nextOccupation) {
        return res.status(400).json({ error: "At least one field must be provided" });
    }

    const nextExtras = {
        ...(profileExtrasByUserId.get(userId) ?? getDefaultExtras()),
    };

    if (nextRegion) nextExtras.region = nextRegion;
    if (nextOccupation) nextExtras.occupation = nextOccupation;
    profileExtrasByUserId.set(userId, nextExtras);

    let nextUser = user;

    if (nextPhone && nextPhone !== user.phone) {
        try {
            nextUser = await prisma.user.update({
                where: { id: userId },
                data: { phone: nextPhone },
            });
        } catch {
            if (usersById[userId]) {
                usersById[userId] = {
                    ...usersById[userId],
                    phone: nextPhone,
                };
                nextUser = usersById[userId];
            }
        }
    }

    return res.json(toMePayload(nextUser));
});

export default router;
