import { useEffect, useReducer } from "react";
import { chatReducer, initialState } from "./chatReducer";
import { useChatSocket } from "./hooks/useChatSocket";
import UserList from "./components/UserList";
import ChatWindow from "./components/ChatWindow";
import { getSocket } from "../../shared/socket";

import "./chat.css";
import "../../styles/variables.css";

export default function Chat({ currentUser }) {
    const [state, dispatch] = useReducer(chatReducer, {
        ...initialState,
        activeChatUserId: null,
        chats: {}
    });

    const { users, chats, activeChatUserId, activeChatId } = state;

    useEffect(() => {
        if (activeChatUserId) return;
        const firstUser = users.find(user => user.id !== currentUser.id);
        if (!firstUser) return;
        dispatch({
            type: "SET_ACTIVE_CHAT_USER",
            payload: firstUser.id
        });
    }, [activeChatUserId, currentUser.id, users]);


    // 🔹 сокет (ВСЕГДА)
    useChatSocket(dispatch, currentUser, activeChatUserId, activeChatId);

    const activeChat = activeChatId ? chats[activeChatId] : null;

    const sendMessage = (text) => {
        if (!activeChatId) return;
        const socket = getSocket();
        if (!socket) return;

        const message = {
            id: crypto.randomUUID(),
            chatId: activeChatId,
            text,
            senderId: currentUser.id,
            fromMe: true,
            status: "sent"
        };

        socket.emit("message:send", message);


        dispatch({
            type: "RECEIVE_MESSAGE",
            payload: {
                chatId: activeChatId,
                message
            }
        });
    };

    return (
        <div className="chat-layout">
            <UserList
                users={users.filter(u => u.id !== currentUser.id)}
                activeUserId={activeChatUserId}
                onSelect={(userId) =>
                    dispatch({
                        type: "SET_ACTIVE_CHAT_USER",
                        payload: userId
                    })
                }
            />

            <ChatWindow
                chat={activeChat}
                currentUserId={currentUser.id}
                onSend={sendMessage}
                onDraftChange={(text) =>
                    dispatch({
                        type: "SET_DRAFT",
                        payload: { chatId: activeChatId, text }
                    })
                }
            />
        </div>
    );
}