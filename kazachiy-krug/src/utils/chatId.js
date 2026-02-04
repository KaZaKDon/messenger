export function getPrivateChatId(a, b) {
    return ["chat", a, b].sort().join("-");
}