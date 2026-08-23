import { purposeLabel } from "./registrationLabels.js";

export function buildRegistrationView(request = {}) {
    const application = request.application ?? {};
    const purposes = Array.isArray(application.purposes)
        ? application.purposes.map(purposeLabel)
        : [];
    const acceptanceCount = Array.isArray(request.acceptances) ? request.acceptances.length : 0;

    return {
        application,
        fullName: [application.lastName, application.firstName].filter(Boolean).join(" "),
        approvalCode: application.approvalCode || "—",
        purposes,
        acceptanceText: acceptanceCount === 3
            ? "Приняты все три"
            : `Принято: ${acceptanceCount} из 3`,
    };
}
