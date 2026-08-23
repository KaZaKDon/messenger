import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../db/prisma.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function tokenHash(token) {
    return createHash("sha256").update(token).digest("hex");
}

export function readBearerToken(req) {
    const [scheme, token] = String(req.headers.authorization ?? "").split(" ");
    return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export async function createSession(userId) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.session.create({ data: { userId, tokenHash: tokenHash(token), expiresAt } });
    return { token, expiresAt };
}

export async function findSessionUser(token) {
    if (!token) return null;
    const session = await prisma.session.findUnique({
        where: { tokenHash: tokenHash(token) },
        include: { user: true },
    });
    if (!session || session.expiresAt <= new Date() || session.user.status !== "active") return null;
    await prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
    return { session, user: session.user };
}

export async function revokeSession(token) {
    if (!token) return;
    await prisma.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
}
