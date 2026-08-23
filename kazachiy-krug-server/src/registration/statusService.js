import { normalizeRussianMobilePhone } from "./phone.js";

function clean(value) {
    return typeof value === "string" ? value.trim() : "";
}

function isSafeRegistrationId(value) {
    return value.length >= 16 && value.length <= 128 && /^[a-zA-Z0-9-]+$/.test(value);
}

export async function findRegistrationStatus({ prisma, source, now = new Date() }) {
    const phone = normalizeRussianMobilePhone(source?.phone);
    const registrationId = clean(source?.registrationId);
    const approvalCode = clean(source?.approvalCode);

    if (!phone) return null;

    let where = null;
    if (isSafeRegistrationId(registrationId)) {
        where = { userId: registrationId, user: { phone } };
    } else if (/^\d{4}$/.test(approvalCode)) {
        // Compatibility with clients released before registrationId was added.
        where = { approvalCode, user: { phone } };
    }

    if (!where) return null;

    const application = await prisma.registrationApplication.findFirst({
        where,
        select: {
            expiresAt: true,
            user: { select: { status: true } },
        },
    });
    if (!application) return null;

    const status = application.user.status === "pending" && application.expiresAt <= now
        ? "expired"
        : application.user.status;

    return { status, expiresAt: application.expiresAt };
}
