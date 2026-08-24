const DEFAULT_LIMIT = 7;
const DEFAULT_WINDOW_MS = 60_000;

function positiveInteger(value, fallback) {
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function createUploadRateLimiter({
    limit = DEFAULT_LIMIT,
    windowMs = DEFAULT_WINDOW_MS,
    now = () => Date.now(),
} = {}) {
    const safeLimit = positiveInteger(limit, DEFAULT_LIMIT);
    const safeWindowMs = positiveInteger(windowMs, DEFAULT_WINDOW_MS);
    const attemptsByUser = new Map();
    let lastCleanupAt = 0;

    function cleanupExpiredUsers(currentTime) {
        if (currentTime - lastCleanupAt < safeWindowMs) return;

        const windowStart = currentTime - safeWindowMs;
        for (const [storedUserId, attempts] of attemptsByUser) {
            const recentAttempts = attempts.filter((timestamp) => timestamp > windowStart);
            if (recentAttempts.length === 0) attemptsByUser.delete(storedUserId);
            else attemptsByUser.set(storedUserId, recentAttempts);
        }
        lastCleanupAt = currentTime;
    }

    return function limitUploads(req, res, next) {
        const userId = req.auth?.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Сессия недействительна" });
        }

        const currentTime = now();
        cleanupExpiredUsers(currentTime);
        const windowStart = currentTime - safeWindowMs;
        const recentAttempts = (attemptsByUser.get(userId) ?? [])
            .filter((timestamp) => timestamp > windowStart);

        if (recentAttempts.length >= safeLimit) {
            const retryAfterMs = Math.max(1, recentAttempts[0] + safeWindowMs - currentTime);
            const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
            attemptsByUser.set(userId, recentAttempts);
            res.set("Retry-After", String(retryAfterSeconds));
            return res.status(429).json({
                error: "Слишком много файлов. Повторите загрузку через минуту",
                code: "UPLOAD_RATE_LIMITED",
                retryAfterSeconds,
            });
        }

        recentAttempts.push(currentTime);
        attemptsByUser.set(userId, recentAttempts);
        return next();
    };
}
