// --------------------
// ФИКСИРОВАННЫЕ ДАННЫЕ
// --------------------


export const usersById = {
    "user-1": { id: "user-1", name: "Казак", phone: "+79515220669", avatar: null },
    "user-2": { id: "user-2", name: "Наташа", phone: "+79515260822", avatar: null },
    "user-3": { id: "user-3", name: "Дима", phone: "+79381532981", avatar: null },
    "user-4": { id: "user-4", name: "Наташа2", phone: "+79613079128", avatar: null },
    "user-5": { id: "user-5", name: "Надя", phone: "+79281256900", avatar: null },
    "user-6": { id: "user-6", name: "Рафиковна", phone: "+79289883569", avatar: null },
    "user-7": { id: "user-7", name: "Рыжий", phone: "+79202695276", avatar: null },
};

/**
 * Получить пользователя по номеру телефона
 */
export function getUserByPhone(phone) {
    const normalized = phone.replace(/\D/g, "");

    return Object.values(usersById).find(user =>
        user.phone.replace(/\D/g, "") === normalized
    ) ?? null;
}