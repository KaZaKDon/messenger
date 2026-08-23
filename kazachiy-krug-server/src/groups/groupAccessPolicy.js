const MODERATION_ROLES = new Set(["admin", "moderator"]);
const GROUP_STATUSES = new Set(["active", "disabled", "archived"]);
const PUBLISH_POLICIES = new Set([
    "members",
    "selected_authors",
    "admin_moderator",
    "owner",
    "admin",
]);

function normalizeUser(user = {}) {
    return {
        id: typeof user.id === "string" ? user.id : "",
        role: typeof user.role === "string" ? user.role : "user",
    };
}

function groupStatus(rule = {}) {
    return GROUP_STATUSES.has(rule.status) ? rule.status : "active";
}

function groupVisibility(rule = {}) {
    if (rule.visibility === "public" || rule.visibility === "private") {
        return rule.visibility;
    }

    // Compatibility with group rules created before visibility was added.
    return rule.mode === "announcements" ? "public" : "private";
}

function groupPublishPolicy(rule = {}) {
    if (PUBLISH_POLICIES.has(rule.publishPolicy)) return rule.publishPolicy;

    if (Array.isArray(rule.publishUserIds) && rule.publishUserIds.length > 0) {
        return "selected_authors";
    }

    return rule.mode === "readonly" ? "selected_authors" : "members";
}

function selectedAuthorIds(rule = {}) {
    const normalizedIds = Array.isArray(rule.publishers)
        ? rule.publishers
            .map((publisher) => publisher?.userId)
            .filter((userId) => typeof userId === "string" && userId)
        : [];

    if (normalizedIds.length > 0) return new Set(normalizedIds);

    const memoryIds = Array.isArray(rule.canPublish)
        ? rule.canPublish.filter((userId) => typeof userId === "string" && userId)
        : [];
    if (memoryIds.length > 0) return new Set(memoryIds);

    const legacyIds = Array.isArray(rule.publishUserIds)
        ? rule.publishUserIds.filter((userId) => typeof userId === "string" && userId)
        : [];

    return new Set(legacyIds);
}

export function isGroupOwnerActive(rule = {}, now = new Date()) {
    if (!rule.ownerId) return false;

    const timestamp = now instanceof Date ? now.getTime() : new Date(now).getTime();
    if (!Number.isFinite(timestamp)) return false;

    const startsAt = rule.ownershipStartsAt == null
        ? null
        : new Date(rule.ownershipStartsAt).getTime();
    const endsAt = rule.ownershipEndsAt == null
        ? null
        : new Date(rule.ownershipEndsAt).getTime();

    if (startsAt != null && (!Number.isFinite(startsAt) || timestamp < startsAt)) return false;
    if (endsAt != null && (!Number.isFinite(endsAt) || timestamp >= endsAt)) return false;

    return true;
}

export function canViewGroup({ rule, isMember = false } = {}) {
    if (!rule) return Boolean(isMember);
    if (groupStatus(rule) !== "active") return false;

    return groupVisibility(rule) === "public" || Boolean(isMember);
}

export function canPublishToGroup({
    rule,
    user,
    isMember = false,
    now = new Date(),
} = {}) {
    const normalizedUser = normalizeUser(user);
    if (!normalizedUser.id) return false;
    if (!canViewGroup({ rule, isMember })) return false;

    switch (groupPublishPolicy(rule)) {
        case "members":
            return true;
        case "selected_authors":
            return selectedAuthorIds(rule).has(normalizedUser.id);
        case "admin_moderator":
            return MODERATION_ROLES.has(normalizedUser.role);
        case "owner":
            return rule.ownerId === normalizedUser.id && isGroupOwnerActive(rule, now);
        case "admin":
            return normalizedUser.role === "admin";
        default:
            return false;
    }
}

export function canModerateGroup(user) {
    return MODERATION_ROLES.has(normalizeUser(user).role);
}

export function canManageGroupMembers({ rule, user } = {}) {
    if (!rule || groupVisibility(rule) !== "private") return false;
    return MODERATION_ROLES.has(normalizeUser(user).role);
}

export function getGroupCapabilities({ rule, user, isMember = false, now = new Date() } = {}) {
    return {
        canView: canViewGroup({ rule, isMember }),
        canPublish: canPublishToGroup({ rule, user, isMember, now }),
        canModerate: canModerateGroup(user),
        canManageMembers: canManageGroupMembers({ rule, user }),
    };
}

