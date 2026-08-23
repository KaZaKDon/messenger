export function publicUser(user) {
    return {
        id: user.id,
        login: user.login,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar ?? null,
        status: user.status,
        role: user.role,
    };
}
