import express from "express";
import { getUserByPhone } from "../store/users.js";

const router = express.Router();

// POST /auth/phone
router.post("/phone", (req, res) => {
    const { phone } = req.body;

    if (!phone) {
        return res.status(400).json({
            error: "Phone is required"
        });
    }

    const user = getUserByPhone(phone);

    if (!user) {
        return res.status(404).json({
            error: "User not found"
        });
    }

    return res.json({
        id: user.id,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar
    });
});

export default router;