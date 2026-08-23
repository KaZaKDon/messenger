import { adminRequest } from "./adminRequest";
import { buildAdminSummary } from "./adminSummary";

export async function fetchAdminSummary(role) {
    const [moderationUsers, groups, advertisements, complaints, supportRequests] = await Promise.all([
        adminRequest("/moderation/users"),
        adminRequest("/moderation/groups"),
        adminRequest("/moderation/advertisements"),
        adminRequest("/moderation/complaints"),
        adminRequest("/moderation/support-requests"),
    ]);

    if (role !== "admin") {
        return buildAdminSummary({
            role,
            moderationUsers,
            groups,
            advertisements,
            complaints,
            supportRequests,
        });
    }

    const [adminUsers, registrations, passwordRecoveries, payments] = await Promise.all([
        adminRequest("/admin/users"),
        adminRequest("/admin/registrations"),
        adminRequest("/admin/password-recoveries?status=pending"),
        adminRequest("/admin/payments"),
    ]);

    return buildAdminSummary({
        role,
        moderationUsers,
        groups,
        adminUsers,
        registrations,
        passwordRecoveries,
        advertisements,
        complaints,
        supportRequests,
        payments,
    });
}
