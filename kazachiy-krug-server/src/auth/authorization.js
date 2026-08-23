export function requireAdmin(req, res, next) {
    if (req.auth?.user?.role !== "admin") {
        return res.status(403).json({ error: "Недостаточно прав" });
    }
    return next();
}

export function requireModeratorOrAdmin(req, res, next) {
    const role = req.auth?.user?.role;
    if (role !== "moderator" && role !== "admin") {
        return res.status(403).json({ error: "Недостаточно прав" });
    }
    return next();
}
