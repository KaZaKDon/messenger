export class RegistrationReviewError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.name = "RegistrationReviewError";
        this.statusCode = statusCode;
    }
}

function cleanReason(value) {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function validateRegistrationDecision(source = {}) {
    const decision = source.decision;
    if (decision !== "approve" && decision !== "reject") {
        throw new RegistrationReviewError(400, "decision must be approve or reject");
    }

    const reason = cleanReason(source.reason);
    if (reason.length > 500) {
        throw new RegistrationReviewError(400, "Причина не должна превышать 500 символов");
    }
    if (decision === "reject" && reason.length < 3) {
        throw new RegistrationReviewError(400, "Укажите причину отклонения заявки");
    }
    return { decision, reason: reason || null };
}

export async function reviewRegistrationApplication({
    prisma,
    userId,
    adminId,
    source,
    now = new Date(),
}) {
    const { decision, reason } = validateRegistrationDecision(source);
    const current = await prisma.user.findUnique({
        where: { id: userId },
        include: { registrationApplication: true },
    });
    if (!current?.registrationApplication) {
        throw new RegistrationReviewError(404, "Заявка не найдена");
    }
    if (current.status !== "pending" || current.registrationApplication.reviewedAt) {
        throw new RegistrationReviewError(409, "Заявка уже обработана");
    }
    if (current.registrationApplication.expiresAt <= now) {
        throw new RegistrationReviewError(410, "Срок действия заявки истёк");
    }

    const status = decision === "approve" ? "active" : "rejected";
    const [user] = await prisma.$transaction([
        prisma.user.update({ where: { id: current.id }, data: { status } }),
        prisma.registrationApplication.update({
            where: { userId: current.id },
            data: {
                approvalCode: null,
                reviewedById: adminId,
                reviewedAt: now,
                reviewReason: reason,
            },
        }),
        prisma.auditLog.create({
            data: {
                adminId,
                action: `registration.${decision}`,
                targetId: current.id,
                details: {
                    previousStatus: current.status,
                    nextStatus: status,
                    reason,
                },
            },
        }),
    ]);
    return user;
}
