export function createHttpErrorHandler({ logger = console } = {}) {
    return function httpErrorHandler(error, _req, res, _next) {
        if (error?.type === "entity.parse.failed") {
            return res.status(400).json({ error: "Некорректный JSON в теле запроса" });
        }

        if (error?.type === "entity.too.large") {
            return res.status(413).json({ error: "Тело запроса слишком большое" });
        }

        if (
            error?.name === "DomainError"
            && Number.isInteger(error.statusCode)
            && error.statusCode >= 400
            && error.statusCode < 500
        ) {
            const payload = { error: error.message, code: error.code };
            if (error.field) payload.field = error.field;
            return res.status(error.statusCode).json(payload);
        }

        logger.error("http request failed:", error);
        return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    };
}

export const httpErrorHandler = createHttpErrorHandler();
