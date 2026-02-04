export function fetchUsersMock() {
    return Promise.resolve([
        { id: "u1", name: "Иван" },
        { id: "u2", name: "Пётр" },
        { id: "u3", name: "Сергей" }
    ]);
}