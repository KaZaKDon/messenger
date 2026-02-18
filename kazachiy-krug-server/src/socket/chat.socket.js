import { chats } from "../store/chats.js";
import { getOrCreatePrivateChat } from "../store/chatHelpers.js";
import { getGroupRuleByChatId } from "../store/groupPolicy.js";
import { usersById } from "../store/users.js";

function pickMembersInfo(memberIds) {
    return memberIds
        .map((id) => usersById[id])
        .filter(Boolean)
        .map(({ id, name, phone, avatar }) => ({ id, name, phone, avatar }));
}

export function chatSocket(io, socket) {
    /**
     * chat:create
     * - если targetUserId = group-* → открываем группу
     * - иначе → открываем/создаём DM (private)
     */
    socket.on("chat:create", ({ targetUserId }) => {
        if (!socket.data.isAuth) return;

        // group-* открываем как групповой чат
        const groupRule = getGroupRuleByChatId(targetUserId);
        if (groupRule) {
            const groupChat = chats[groupRule.roomId];
            if (!groupChat) return;
            if (!groupChat.members.includes(socket.data.userId)) return;

            socket.emit("chat:open", groupChat);
            return;
        }

        // DM
        const currentUserId = socket.data.userId;
        if (!targetUserId || currentUserId === targetUserId) return;

        const chat = getOrCreatePrivateChat(currentUserId, targetUserId);

        // отдаём сразу полезные данные для UI лички (телефон всегда)
        const membersInfo = pickMembersInfo(chat.members);
        const otherId = chat.members.find((id) => id !== currentUserId);
        const otherUser = otherId ? usersById[otherId] : null;

        socket.emit("chat:open", {
            chatId: chat.id,
            type: "private",
            members: chat.members,
            membersInfo,
            otherUser: otherUser
                ? { id: otherUser.id, name: otherUser.name, phone: otherUser.phone, avatar: otherUser.avatar }
                : null,
            messages: chat.messages,
        });
    });

    /**
     * chat:open (from/to) — старый протокол
     * Поддерживаем и группы, и DM.
     */
    socket.on("chat:open", ({ from, to }) => {
        if (!socket.data.isAuth) return;

        // group-* через to
        const groupRule = getGroupRuleByChatId(to);
        if (groupRule) {
            const groupChat = chats[groupRule.roomId];
            if (!groupChat) return;
            if (!groupChat.members.includes(socket.data.userId)) return;

            socket.emit("chat:opened", {
                chatId: groupChat.id,
                title: groupChat.title,
                type: groupChat.type,
                members: groupChat.members,
                messages: groupChat.messages,
            });
            return;
        }

        // DM
        const chat = getOrCreatePrivateChat(from, to);

        const currentUserId = socket.data.userId;
        const membersInfo = pickMembersInfo(chat.members);
        const otherId = chat.members.find((id) => id !== currentUserId);
        const otherUser = otherId ? usersById[otherId] : null;

        socket.emit("chat:opened", {
            chatId: chat.id,
            type: "private",
            members: chat.members,
            membersInfo,
            otherUser: otherUser
                ? { id: otherUser.id, name: otherUser.name, phone: otherUser.phone, avatar: otherUser.avatar }
                : null,
            messages: chat.messages,
        });
    });

    socket.on("join:chat", ({ chatId }) => {
        if (!socket.data.isAuth) return;

        const chat = chats[chatId];
        if (!chat) return;
        if (!chat.members.includes(socket.data.userId)) return;
        if (socket.rooms.has(chatId)) return;

        socket.join(chatId);

        console.log(`👥 ${socket.data.userName} joined ${chatId}`);
    });
}