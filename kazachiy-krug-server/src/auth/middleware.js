import { findSessionUser, readBearerToken } from "./session.js";

export async function requireAuth(req, res, next) {
    const auth = await findSessionUser(readBearerToken(req));
    if (!auth) return res.status(401).json({ error: "Сессия недействительна" });
    req.auth = auth;
    return next();
}
